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
      await expect(accountNav(page).getByRole("link", { name: "Sign in" })).toHaveAttribute(
        "href",
        "/account/sign-in/",
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
