import { test, expect } from "@playwright/test";

test.describe("llms.txt", () => {
  test("is served at /llms.txt", async ({ request }) => {
    const response = await request.get("/llms.txt");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("Jazz Jam Studio");
  });

  test("contains site description", async ({ request }) => {
    const response = await request.get("/llms.txt");
    const body = await response.text();
    expect(body).toContain("jazz");
    expect(body).toContain("practice");
  });
});
