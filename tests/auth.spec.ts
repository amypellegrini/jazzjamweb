import { test, expect, type Page, type BrowserContext } from "@playwright/test";

// These tests run against tests/support/auth-harness.mjs: the real Worker, with an
// in-memory fake standing in for Supabase (CI can't reach a real project). The fake
// asks for email confirmation on sign-up, as a new Supabase project does, and its
// /__control hooks hand the tests what a real inbox would.
const AUTH_ORIGIN = `http://localhost:${process.env.PLAYWRIGHT_AUTH_PORT ?? 8788}`;
const FAKE = `${AUTH_ORIGIN}/__fake-supabase`;

test.use({ baseURL: AUTH_ORIGIN });

const PAGES = [
  "/",
  "/articles/block-chords/",
  "/courses/block-chords/",
  "/courses/block-chords/building-block-chords/",
  "/privacy-policy/",
  "/terms-of-service/",
  "/license/",
];

let counter = 0;
function uniqueEmail(label: string) {
  return `${label}-${Date.now()}-${++counter}@example.com`;
}

function accountNav(page: Page) {
  return page.getByRole("navigation", { name: "Account" });
}

async function expectSignedOut(page: Page) {
  const nav = accountNav(page);
  await expect(nav.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Sign out" })).toBeHidden();
}

async function expectSignedIn(page: Page, email: string) {
  const nav = accountNav(page);
  await expect(nav.getByText(email)).toBeVisible();
  await expect(nav.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Sign in" })).toBeHidden();
}

// Signs the browser in by handing it a session the fake issued, the way a finished
// sign-in leaves it: the Worker's two HttpOnly cookies.
async function seedSession(context: BrowserContext, email: string) {
  const response = await context.request.post(`${FAKE}/__control/sessions`, { data: { email } });
  const session = await response.json();
  await context.addCookies([
    { name: "jj_at", value: session.access_token, url: AUTH_ORIGIN, httpOnly: true, secure: true, sameSite: "Lax" },
    { name: "jj_rt", value: session.refresh_token, url: AUTH_ORIGIN, httpOnly: true, secure: true, sameSite: "Lax" },
  ]);
}

test.describe("Account status in the header", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("https://plausible.io/**", (route) => route.fulfill({ body: "" }));
  });

  for (const path of PAGES) {
    test(`shows a signed-out visitor a sign-in link on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expectSignedOut(page);
      // ...which brings them back here afterwards.
      await expect(accountNav(page).getByRole("link", { name: "Sign in" })).toHaveAttribute(
        "href",
        `/account/sign-in/?next=${encodeURIComponent(path)}`,
      );
    });

    test(`shows a signed-in student who they are signed in as on ${path}`, async ({ page, context }) => {
      const email = uniqueEmail("header");
      await seedSession(context, email);
      await page.goto(path);
      await expectSignedIn(page, email);
    });
  }
});

test("falls back to signed out where no Worker answers /auth/session", async ({ page }) => {
  // The Eleventy dev server alone (npm start) has no auth routes.
  await page.route("https://plausible.io/**", (route) => route.fulfill({ body: "" }));
  await page.goto(`http://localhost:${process.env.PLAYWRIGHT_PORT ?? 8080}/`);
  await expectSignedOut(page);
});

// What a student would click in the email: the link the Supabase email templates in
// docs/supabase-setup.md build, {{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=….
async function emailLink(page: Page, email: string, type: "email" | "recovery") {
  const response = await page.request.get(`${FAKE}/__control/outbox?email=${encodeURIComponent(email)}`);
  expect(response.ok(), `an email was sent to ${email}`).toBe(true);
  const message = await response.json();
  return `${message.redirect_to}?token_hash=${message.token_hash}&type=${type}`;
}

async function createPasswordAccount(page: Page, email: string, password: string) {
  await page.request.post(`${FAKE}/__control/users`, { data: { email, password } });
}

async function signInWithEmail(page: Page, email: string, password: string) {
  await page.goto("/account/sign-in/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

function accountMessage(page: Page) {
  return page.locator("[data-account-message]");
}

test.describe("Account flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("https://plausible.io/**", (route) => route.fulfill({ body: "" }));
  });

  test("a new visitor creates an account with their email and is shown as signed in", async ({ page }) => {
    const email = uniqueEmail("signup");
    await page.goto("/");
    await accountNav(page).getByRole("link", { name: "Sign in" }).click();
    await page.getByRole("link", { name: "Create an account" }).click();
    await expect(page).toHaveURL(/\/account\/sign-up\//);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("a good long password");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(accountMessage(page)).toHaveText(/Check your email/);
    await expectSignedOut(page);

    await page.goto(await emailLink(page, email, "email"));
    await expect(page).toHaveURL(/\/account\/$/);
    await expectSignedIn(page, email);
    await expect(page.locator("main")).toContainText(`You're signed in as ${email}`);
  });

  test("a student signs in with their email and password, back on the page they left", async ({ page }) => {
    const email = uniqueEmail("signin");
    await createPasswordAccount(page, email, "correct horse battery");
    await page.goto("/courses/block-chords/");
    await accountNav(page).getByRole("link", { name: "Sign in" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("correct horse battery");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/courses\/block-chords\/$/);
    await expectSignedIn(page, email);
  });

  test("a wrong password is explained, and the student stays signed out", async ({ page }) => {
    const email = uniqueEmail("wrong");
    await createPasswordAccount(page, email, "correct horse battery");
    await signInWithEmail(page, email, "not it");
    await expect(page).toHaveURL(/\/account\/sign-in\//);
    await expect(accountMessage(page)).toHaveText("That email and password don't match an account.");
    await expectSignedOut(page);
  });

  test("a student creates an account and signs in with Continue with Google", async ({ page }) => {
    await page.goto("/courses/block-chords/building-block-chords/");
    await accountNav(page).getByRole("link", { name: "Sign in" }).click();
    await page.getByRole("link", { name: "Continue with Google" }).click();

    // The fake stands in for Google's consent screen and comes straight back.
    await expect(page).toHaveURL(/\/courses\/block-chords\/building-block-chords\/$/);
    await expectSignedIn(page, "google.student@example.com");
  });

  test("Continue with Google is on the sign-up page too", async ({ page }) => {
    await page.goto("/account/sign-up/");
    await page.getByRole("link", { name: "Continue with Google" }).click();
    await expect(page).toHaveURL(/\/account\/$/);
    await expectSignedIn(page, "google.student@example.com");
  });

  test("a student who forgot their password recovers the account and signs back in", async ({ page }) => {
    const email = uniqueEmail("recover");
    await createPasswordAccount(page, email, "the old password");
    await page.goto("/account/sign-in/");
    await page.getByRole("link", { name: "Forgot your password?" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(accountMessage(page)).toHaveText(/we've sent it a link/);

    await page.goto(await emailLink(page, email, "recovery"));
    await expect(page).toHaveURL(/\/account\/reset-password\/$/);
    await page.getByLabel("New password").fill("the new password");
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(accountMessage(page)).toHaveText("Your password has been updated.");
    await expectSignedIn(page, email);

    await accountNav(page).getByRole("button", { name: "Sign out" }).click();
    await expectSignedOut(page);
    await signInWithEmail(page, email, "the new password");
    await expectSignedIn(page, email);
  });

  test("a signed-in student who closes the browser and comes back is still signed in", async ({ page, browser }) => {
    const email = uniqueEmail("persist");
    await createPasswordAccount(page, email, "correct horse battery");
    await signInWithEmail(page, email, "correct horse battery");
    await expectSignedIn(page, email);

    // Persistent cookies, not session cookies (which closing the browser drops).
    const cookies = await page.context().cookies();
    for (const name of ["jj_at", "jj_rt"]) {
      const cookie = cookies.find((c) => c.name === name)!;
      expect(cookie.httpOnly, name).toBe(true);
      expect(cookie.expires, name).toBeGreaterThan(Date.now() / 1000 + 29 * 24 * 60 * 60);
    }
    const saved = await page.context().storageState();
    await page.context().close();

    // Coming back after the hour an access token lasts: the refresh token carries it.
    const reopened = await browser.newContext({ storageState: saved });
    await reopened.request.post(`${FAKE}/__control/expire-access-tokens`);
    const again = await reopened.newPage();
    await again.route("https://plausible.io/**", (route) => route.fulfill({ body: "" }));
    await again.goto(`${AUTH_ORIGIN}/`);
    await expectSignedIn(again, email);
    await reopened.close();
  });

  test("a signed-in student signs out and the header shows them signed out", async ({ page }) => {
    const email = uniqueEmail("signout");
    await createPasswordAccount(page, email, "correct horse battery");
    await signInWithEmail(page, email, "correct horse battery");
    await page.goto("/articles/block-chords/");
    await expectSignedIn(page, email);

    await accountNav(page).getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/articles\/block-chords\/$/);
    await expectSignedOut(page);
    await page.reload();
    await expectSignedOut(page);
  });
});
