import { test, expect } from "@playwright/test";

test.describe("License page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/license/");
  });

  test("displays the page heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", {
        name: "Third-Party Software Acknowledgments",
      })
    ).toBeVisible();
  });

  test("lists FluidSynth acknowledgment", async ({ page }) => {
    await expect(page.locator("body")).toContainText("FluidSynth");
    await expect(page.locator("body")).toContainText(
      "GNU Lesser General Public License"
    );
  });

  test("lists Leland Font acknowledgment", async ({ page }) => {
    await expect(page.locator("body")).toContainText("Leland");
    await expect(page.locator("body")).toContainText("SIL Open Font License");
  });

  test("lists MuseScore soundfont acknowledgment", async ({ page }) => {
    await expect(page.locator("body")).toContainText("MuseScore_General");
    await expect(page.locator("body")).toContainText("MIT License");
  });
});
