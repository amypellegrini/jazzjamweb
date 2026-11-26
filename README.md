# Jazz Jam Web

This is the web site for Jazz Jam Studio.

## Development

```bash
npm install
npm run start
```

## Pre-commit hooks

This project uses [Husky](https://typicode.github.io/husky/) to run the test suite before each commit. Hooks are installed automatically via the `prepare` script when you run `npm install`.

If tests fail, the commit will be aborted.

## Deployment

```bash
npm run build
```

The site is served by a Cloudflare Worker (`wrangler.jsonc`): the Eleventy build as static
assets, plus the account routes under `/auth/` in `worker/`. Accounts use Supabase; the
one-time project, Google sign-in and Worker secret setup is in
[docs/supabase-setup.md](docs/supabase-setup.md).

## Tests

`npm test` runs the Worker's unit tests (`npm run test:worker`, Node's test runner) and
the Playwright suite (`npm run test:e2e`). The account tests run the Worker against an
in-memory fake of Supabase, so no Supabase project is needed. `PLAYWRIGHT_PORT` and
`PLAYWRIGHT_AUTH_PORT` (default 8080 and 8788) move the test servers, e.g. to run two
worktrees side by side.
