# Supabase setup for jazzjam.app accounts

Sign-up and sign-in on jazzjam.app (issue #78) go through the Cloudflare Worker
(`worker/`), which talks to Supabase Auth on the browser's behalf and keeps the
session in HttpOnly cookies. None of the Supabase project, the Google OAuth client
or the Worker secrets can be created from the repository: this is the one-time
manual setup, in order.

The Worker needs exactly two values, both read from its environment and never
committed:

| Name                | What it is                                                   |
| ------------------- | ------------------------------------------------------------ |
| `SUPABASE_URL`      | The project URL, `https://<project-ref>.supabase.co`         |
| `SUPABASE_ANON_KEY` | The project's public key (the publishable key, or the legacy `anon` key) |

No service-role (secret) key is needed: every call the Worker makes is one a browser
could make. Until both are set, the site still deploys and works; the header shows
everyone as signed out and the account forms say accounts are unavailable.

The same Supabase project is meant to be reused later by the app and the MCP server
(amypellegrini/musicpracticepro#824), so name it for JazzJam rather than for the website.

## 1. Create the Supabase project

1. At <https://supabase.com/dashboard>, create a new project (for example `jazzjam`).
   Pick the region closest to most students, and keep the database password somewhere
   safe (the Worker doesn't use it).
2. Open **Project Settings → API Keys** (or **Data API**) and note:
   - the **Project URL** → `SUPABASE_URL`
   - the **publishable** key (`sb_publishable_…`), or the legacy **anon** key → `SUPABASE_ANON_KEY`

## 2. Email sign-in

1. **Authentication → Sign In / Providers → Email**: make sure **Email** is enabled.
2. Leave **Confirm email** on (the default). A new account is then signed in once the
   student follows the link in the confirmation email. (With it off, sign-up signs the
   student in straight away; the Worker handles both.)
3. The sign-up form says passwords need at least 6 characters, Supabase's default
   minimum. If you raise **Minimum password length**, update the hint in
   `src/account/sign-up.njk` and `src/account/reset-password.njk`.

## 3. URL configuration

**Authentication → URL Configuration**:

- **Site URL**: `https://jazzjam.app`
- **Redirect URLs** (add each):
  - `https://jazzjam.app/auth/confirm`
  - `https://jazzjam.app/auth/callback`
  - `http://localhost:8787/**` (local development with `wrangler dev`)
  - optionally `https://jazzjamweb.<your-subdomain>.workers.dev/**`, to try it on the
    workers.dev URL before the custom domain

The Worker builds these from the address the request came in on, so the same code
works in production and locally. A redirect URL that isn't on this list is replaced by
the Site URL, which breaks the email links below.

## 4. Email templates

The Worker confirms email links itself (`GET /auth/confirm`), so the links in the two
emails it relies on must point there with a token hash. In **Authentication → Emails →
Templates**:

- **Confirm signup** — replace the link with:

  ```html
  <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
  ```

- **Reset Password** — replace the link with:

  ```html
  <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Choose a new password</a>
  ```

`{{ .RedirectTo }}` is the `…/auth/confirm` address the Worker sent with the request.
Unlike the default `{{ .ConfirmationURL }}`, these links work even when the student
opens the email on another device or browser.

**Before launch:** Supabase's built-in email sender is for testing only and sends just
a few emails an hour. Under **Authentication → Emails → SMTP Settings**, set up a
custom SMTP provider for production (and send from a jazzjam.app address).

## 5. Continue with Google

1. In the Google Cloud console (<https://console.cloud.google.com/>), select or create a
   project for JazzJam.
2. **APIs & Services → OAuth consent screen** (Google Auth Platform → Branding /
   Audience): app name *JazzJam*, a support email, authorised domain `jazzjam.app`, and
   links to <https://jazzjam.app/privacy-policy/> and
   <https://jazzjam.app/terms-of-service/>. The scopes needed are `openid`, `email` and
   `profile`, the defaults. Publish the app (move it from *Testing* to *In production*),
   or only listed test users can sign in.
3. **Credentials → Create credentials → OAuth client ID**, type **Web application**:
   - **Authorised JavaScript origins**: `https://jazzjam.app`
   - **Authorised redirect URIs**: `https://<project-ref>.supabase.co/auth/v1/callback`
     (Supabase shows this exact URL on its Google provider page)
4. Copy the **Client ID** and **Client secret**.
5. In Supabase, **Authentication → Sign In / Providers → Google**: enable it, paste the
   Client ID and Client secret, and save.

Google returns to Supabase, Supabase returns to `https://jazzjam.app/auth/callback`, and
the Worker exchanges the code (PKCE) for a session. A student who signs in with Google
using the same email as an existing email account gets that same account (Supabase
links the two identities).

## 6. Worker secrets

Set the two values on the `jazzjamweb` Worker. Either in the Cloudflare dashboard
(**Workers & Pages → jazzjamweb → Settings → Variables and Secrets → Add**, type
*Secret*), or from a checkout with Wrangler logged in to the account:

```sh
npx wrangler@4.158.0 secret put SUPABASE_URL
npx wrangler@4.158.0 secret put SUPABASE_ANON_KEY
```

Each command prompts for the value, so it never lands in shell history or the repo.

Secrets persist across deploys. **The deploy workflow needs no change and no new GitHub
secrets**: `.github/workflows/deploy.yml` already deploys with `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`, and `wrangler deploy` now picks up `main` (`worker/index.mjs`)
from `wrangler.jsonc` alongside the static assets. The GitHub Pages deploy can't serve
accounts (it has no Worker); accounts work on the Cloudflare deployment, which is what
jazzjam.app serves.

## 7. Local development

`npm start` (Eleventy alone) has no `/auth/` routes; the header just shows signed out.
To run the Worker locally against the real project:

1. Create `.dev.vars` in the repository root (it is gitignored):

   ```sh
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_ANON_KEY=sb_publishable_…
   ```

2. `npm run build && npx wrangler@4.158.0 dev`, then open <http://localhost:8787>.

The automated tests never use a real project: `npm test` runs the Worker's unit tests
(`worker/test/`) and the Playwright account tests (`tests/auth.spec.ts`) against an
in-memory fake of the Supabase Auth API (`tests/support/fake-supabase.mjs`).

## 8. Check it works

On the deployed site (or `wrangler dev`), walk the issue's manual verification:

1. Sign up with email, follow the confirmation email, and see your email in the header.
2. Sign out; the header shows **Sign in**.
3. Sign in with **Continue with Google**.
4. **Forgot your password?** → follow the email → choose a new password → sign back in
   with it.
5. Close the browser completely, reopen jazzjam.app: still signed in.
