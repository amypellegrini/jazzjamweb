import { defineConfig } from "@playwright/test";

// Overridable so parallel checkouts (git worktrees) running their suites at the same
// time don't share, or tear down, each other's dev server: a server already up on
// the port is reused outside CI.
const port = Number(process.env.PLAYWRIGHT_PORT ?? 8080);
// The Worker with a fake Supabase in front of that dev server, for the account tests.
const authPort = Number(process.env.PLAYWRIGHT_AUTH_PORT ?? 8788);

export default defineConfig({
  testDir: "./tests",
  webServer: [
    {
      command: `npx eleventy --serve --port=${port}`,
      port,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "node tests/support/auth-harness.mjs",
      port: authPort,
      reuseExistingServer: !process.env.CI,
      env: { AUTH_HARNESS_PORT: String(authPort), ELEVENTY_URL: `http://localhost:${port}` },
    },
  ],
  use: {
    baseURL: `http://localhost:${port}`,
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        // Pages load the real Plausible script, and a stalled request to plausible.io
        // holds up the page's load event until the test times out. Resolving the host
        // to nothing fails it at once instead; tests that need Plausible stub it with
        // page.route, which answers before any DNS lookup.
        launchOptions: { args: ["--host-resolver-rules=MAP plausible.io ~NOTFOUND"] },
      },
    },
  ],
});
