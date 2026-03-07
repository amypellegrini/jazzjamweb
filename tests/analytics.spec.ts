import { test, expect } from "@playwright/test";

test.describe("Analytics tracking", () => {
  const pages = [
    { name: "home page", path: "/" },
    { name: "privacy policy", path: "/privacy-policy/" },
    { name: "license", path: "/license/" },
  ];

  for (const { name, path } of pages) {
    test(`${name} includes Plausible analytics script`, async ({ page }) => {
      await page.goto(path);
      const script = page.locator(
        'script[src="https://plausible.io/js/pa-6gVA4g1_BezmrRwhMYs_B.js"]'
      );
      await expect(script).toHaveCount(1);
      await expect(script).toHaveAttribute("async", "");
    });
  }
});
