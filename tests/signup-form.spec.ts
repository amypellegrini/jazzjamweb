import { test, expect, type Page, type Request } from "@playwright/test";

// The signup form posts straight to MailerLite from the browser. These tests
// intercept that request, so CI never creates a real subscriber: they pin the
// account/form IDs and payload MailerLite expects, and how the page reacts to
// each kind of MailerLite response.
const MAILERLITE_ACCOUNT_ID = "1439006";
const MAILERLITE_FORM_ID = "151125911451731083";
const MAILERLITE_SUBSCRIBE_URL = `https://assets.mailerlite.com/jsonp/${MAILERLITE_ACCOUNT_ID}/forms/${MAILERLITE_FORM_ID}/subscribe`;

async function stubPlausible(page: Page) {
  // Keep the inline queue stub in place so tests can read the events the page
  // sends, instead of letting the real script ship them to Plausible.
  await page.route("https://plausible.io/**", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "" })
  );
}

async function stubMailerLite(page: Page, json: unknown) {
  const requests: Request[] = [];
  await page.route("https://assets.mailerlite.com/**", (route) => {
    requests.push(route.request());
    return route.fulfill({ contentType: "application/json", json });
  });
  return requests;
}

async function submitEmail(page: Page, email: string) {
  const form = page.locator("#beta-signup-form");
  await form.getByLabel("email").fill(email);
  await form.getByRole("button", { name: "Subscribe" }).click();
}

test.describe("MailerLite signup form", () => {
  test.beforeEach(async ({ page }) => {
    await stubPlausible(page);
  });

  test("posts the email to the JazzJam MailerLite form endpoint", async ({ page }) => {
    const requests = await stubMailerLite(page, { success: true });
    await page.goto("/");

    await submitEmail(page, "player@example.com");

    await expect.poll(() => requests.length).toBe(1);
    const request = requests[0];
    expect(request.method()).toBe("POST");
    expect(request.url()).toBe(MAILERLITE_SUBSCRIBE_URL);
    const body = request.postData() ?? "";
    expect(body).toMatch(/name="fields\[email\]"\r\n\r\nplayer@example\.com\r\n/);
    expect(body).toMatch(/name="ml-submit"\r\n\r\n1\r\n/);
    expect(body).toMatch(/name="anticsrf"\r\n\r\ntrue\r\n/);
  });

  // Plausible's automatic "Form: Submission" goal fires on every valid submit,
  // before MailerLite has answered — it counts attempts, not signups. The
  // "Signup" event is the one that only fires once MailerLite accepts the email.
  test("sends a Plausible Signup event once MailerLite accepts the email", async ({ page }) => {
    await stubMailerLite(page, { success: true });
    await page.goto("/");

    await submitEmail(page, "player@example.com");

    await expect(page.locator(".form-message")).toHaveText(
      "Thanks for subscribing! Check your email (and spam folder)."
    );
    expect(await plausibleEvents(page)).toContain("Signup");
  });

  test("does not send a Plausible Signup event when MailerLite rejects the email", async ({ page }) => {
    await stubMailerLite(page, {
      success: false,
      errors: { fields: { email: ["The email must be a valid email address."] } },
    });
    await page.goto("/");

    await submitEmail(page, "player@example.com");

    await expect(page.locator(".form-message")).toHaveClass(/form-message-error/);
    expect(await plausibleEvents(page)).not.toContain("Signup");
  });

  test("shows MailerLite's field error when it rejects the email", async ({ page }) => {
    await stubMailerLite(page, {
      success: false,
      errors: { fields: { email: ["The email must be a valid email address."] } },
    });
    await page.goto("/");

    await submitEmail(page, "player@example.com");

    await expect(page.locator(".form-message")).toHaveText(
      "The email must be a valid email address."
    );
  });
});

async function plausibleEvents(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const queue = (window as unknown as { plausible: { q?: unknown[][] } }).plausible.q ?? [];
    return queue.map((args) => String(args[0]));
  });
}
