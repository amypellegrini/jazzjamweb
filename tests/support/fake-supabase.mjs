// An in-memory stand-in for the slice of the Supabase Auth (GoTrue) HTTP API the
// Worker calls. CI can't reach a real Supabase project, so both the Worker's unit
// tests (worker/test/) and the Playwright auth harness (tests/support/auth-harness.mjs)
// run against this. It mirrors the request and response shapes of the real API
// closely enough to pin them, not its every rule.
//
// Test-only controls live beside the API under /__control:
//   GET  /__control/outbox?email=…        the latest email "sent" to that address
//   POST /__control/expire-access-tokens  every issued access token stops working
//   POST /__control/sessions {email}      a session for a (new or existing) user
//   POST /__control/users {email,password} a confirmed email-and-password account
const encoder = new TextEncoder();

async function sha256Base64Url(value) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function apiError(status, errorCode, msg) {
  return json({ code: status, error_code: errorCode, msg }, status);
}

export const FAKE_ANON_KEY = "fake-anon-key";

export function createFakeSupabase({
  basePath = "",
  confirmEmail = false,
  googleEmail = "google.student@example.com",
} = {}) {
  const users = new Map(); // email -> { id, email, password, confirmed }
  const accessTokens = new Map(); // token -> email
  const refreshTokens = new Map(); // token -> email
  const authCodes = new Map(); // code -> { email, challenge }
  const emailTokens = new Map(); // token_hash -> { email, type }
  const outbox = [];
  const calls = [];
  let counter = 0;
  const next = (prefix) => `${prefix}-${++counter}-${Math.random().toString(36).slice(2, 10)}`;

  function publicUser(user) {
    return { id: user.id, email: user.email, aud: "authenticated", role: "authenticated" };
  }

  function issueSession(email) {
    const access = next("access");
    const refresh = next("refresh");
    accessTokens.set(access, email);
    refreshTokens.set(refresh, email);
    return {
      access_token: access,
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: refresh,
      user: publicUser(users.get(email)),
    };
  }

  function createUser(email, password, confirmed) {
    const user = { id: next("user"), email, password, confirmed };
    users.set(email, user);
    return user;
  }

  function sendEmail(email, type, redirectTo) {
    const tokenHash = next(`${type}-hash`);
    emailTokens.set(tokenHash, { email, type });
    outbox.push({ email, type, token_hash: tokenHash, redirect_to: redirectTo });
  }

  function bearer(request) {
    const header = request.headers.get("authorization") ?? "";
    return header.startsWith("Bearer ") ? header.slice(7) : null;
  }

  async function body(request) {
    try {
      return await request.json();
    } catch {
      return {};
    }
  }

  const routes = {
    "POST /auth/v1/signup": async (request, url) => {
      const { email, password } = await body(request);
      if (!email || !email.includes("@")) return apiError(400, "email_address_invalid", "Invalid email");
      if (!password || password.length < 6) {
        return apiError(422, "weak_password", "Password should be at least 6 characters.");
      }
      const existing = users.get(email);
      if (existing?.confirmed) return apiError(422, "user_already_exists", "User already registered");
      const user = existing ?? createUser(email, password, !confirmEmail);
      if (confirmEmail) {
        sendEmail(email, "signup", url.searchParams.get("redirect_to"));
        return json(publicUser(user));
      }
      return json(issueSession(email));
    },

    "POST /auth/v1/token": async (request, url) => {
      const grant = url.searchParams.get("grant_type");
      const params = await body(request);
      if (grant === "password") {
        const user = users.get(params.email);
        if (!user || user.password !== params.password) {
          return apiError(400, "invalid_credentials", "Invalid login credentials");
        }
        if (!user.confirmed) return apiError(400, "email_not_confirmed", "Email not confirmed");
        return json(issueSession(user.email));
      }
      if (grant === "refresh_token") {
        const email = refreshTokens.get(params.refresh_token);
        if (!email) return apiError(400, "refresh_token_not_found", "Invalid Refresh Token");
        refreshTokens.delete(params.refresh_token);
        return json(issueSession(email));
      }
      if (grant === "pkce") {
        const entry = authCodes.get(params.auth_code);
        if (!entry || (await sha256Base64Url(params.code_verifier ?? "")) !== entry.challenge) {
          return apiError(400, "bad_code_verifier", "code challenge does not match previously saved code verifier");
        }
        authCodes.delete(params.auth_code);
        return json(issueSession(entry.email));
      }
      return apiError(400, "unsupported_grant_type", "Unsupported grant type");
    },

    // Real Supabase sends the browser to Google first; the fake skips straight to the
    // consent having been given and returns to the app with an auth code.
    "GET /auth/v1/authorize": async (_request, url) => {
      if (url.searchParams.get("provider") !== "google") {
        return apiError(400, "validation_failed", "Unsupported provider");
      }
      if (url.searchParams.get("code_challenge_method") !== "s256") {
        return apiError(400, "validation_failed", "PKCE required");
      }
      if (!users.has(googleEmail)) createUser(googleEmail, null, true);
      const code = next("code");
      authCodes.set(code, { email: googleEmail, challenge: url.searchParams.get("code_challenge") });
      const back = new URL(url.searchParams.get("redirect_to"));
      back.searchParams.set("code", code);
      return new Response(null, { status: 302, headers: { location: back.toString() } });
    },

    "POST /auth/v1/verify": async (request) => {
      const { token_hash: tokenHash, type } = await body(request);
      const entry = emailTokens.get(tokenHash);
      const typeMatches = entry && (entry.type === type || (entry.type === "signup" && type === "email"));
      if (!typeMatches) return apiError(403, "otp_expired", "Email link is invalid or has expired");
      emailTokens.delete(tokenHash);
      users.get(entry.email).confirmed = true;
      return json(issueSession(entry.email));
    },

    "POST /auth/v1/recover": async (request, url) => {
      const { email } = await body(request);
      if (users.has(email)) sendEmail(email, "recovery", url.searchParams.get("redirect_to"));
      return json({});
    },

    "GET /auth/v1/user": async (request) => {
      const email = accessTokens.get(bearer(request));
      if (!email) return apiError(401, "bad_jwt", "invalid JWT");
      return json(publicUser(users.get(email)));
    },

    "PUT /auth/v1/user": async (request) => {
      const email = accessTokens.get(bearer(request));
      if (!email) return apiError(401, "bad_jwt", "invalid JWT");
      const { password } = await body(request);
      if (!password || password.length < 6) {
        return apiError(422, "weak_password", "Password should be at least 6 characters.");
      }
      users.get(email).password = password;
      return json(publicUser(users.get(email)));
    },

    "POST /auth/v1/logout": async (request) => {
      const token = bearer(request);
      const email = accessTokens.get(token);
      if (!email) return apiError(401, "bad_jwt", "invalid JWT");
      accessTokens.delete(token);
      for (const [refresh, owner] of refreshTokens) if (owner === email) refreshTokens.delete(refresh);
      return new Response(null, { status: 204 });
    },

    "GET /__control/outbox": async (_request, url) => {
      const message = latestEmail(url.searchParams.get("email"));
      return message ? json(message) : json({ error: "no email sent" }, 404);
    },

    "POST /__control/sessions": async (request) => {
      const { email } = await body(request);
      if (!users.has(email)) createUser(email, "password", true);
      return json(issueSession(email));
    },

    "POST /__control/users": async (request) => {
      const { email, password } = await body(request);
      createUser(email, password, true);
      return new Response(null, { status: 204 });
    },

    "POST /__control/expire-access-tokens": async () => {
      accessTokens.clear();
      return new Response(null, { status: 204 });
    },
  };

  function latestEmail(email) {
    return outbox.filter((m) => m.email === email).at(-1);
  }

  async function handle(request) {
    const url = new URL(request.url);
    const path = url.pathname.startsWith(basePath) ? url.pathname.slice(basePath.length) : url.pathname;
    calls.push({ method: request.method, path, search: url.search, headers: request.headers });
    const route = routes[`${request.method} ${path}`];
    if (!route) return apiError(404, "not_found", `No fake for ${request.method} ${path}`);
    // The browser itself opens /authorize, without the API key; every server call carries it.
    const needsKey = path.startsWith("/auth/v1/") && path !== "/auth/v1/authorize";
    if (needsKey && request.headers.get("apikey") !== FAKE_ANON_KEY) {
      return json({ message: "No API key found in request" }, 401);
    }
    return route(request, url);
  }

  return {
    handle,
    calls,
    outbox,
    users,
    latestEmail,
    // Same signature as the global fetch, answered by the fake.
    fetch: (input, init) => handle(new Request(input, init)),
    expireAccessTokens: () => accessTokens.clear(),
    // Seeds a confirmed email-and-password account.
    addUser: (email, password) => createUser(email, password, true),
  };
}
