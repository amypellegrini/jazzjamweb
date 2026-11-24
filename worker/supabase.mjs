// A thin client for the Supabase Auth (GoTrue) REST API, the endpoints supabase-js
// calls under the hood. Every call resolves to { ok: true, data } or
// { ok: false, status, error }, where error is one of the codes the account pages
// know how to explain (see src/assets/js/account-forms.js).
const ERROR_CODES = {
  invalid_credentials: "invalid_credentials",
  invalid_grant: "invalid_credentials",
  user_already_exists: "email_taken",
  email_exists: "email_taken",
  weak_password: "weak_password",
  same_password: "same_password",
  email_not_confirmed: "email_not_confirmed",
  email_address_invalid: "invalid_email",
  validation_failed: "invalid_email",
  over_email_send_rate_limit: "rate_limited",
  over_request_rate_limit: "rate_limited",
  otp_expired: "link_expired",
  bad_code_verifier: "oauth_failed",
  flow_state_not_found: "oauth_failed",
  flow_state_expired: "oauth_failed",
};

function errorCode(status, data) {
  const raw = data?.error_code ?? data?.error;
  if (raw && ERROR_CODES[raw]) return ERROR_CODES[raw];
  if (status === 429) return "rate_limited";
  return "unknown";
}

export function createSupabaseAuth({ url, anonKey, fetch = globalThis.fetch }) {
  const base = `${url.replace(/\/+$/, "")}/auth/v1`;

  function endpoint(path, query = {}) {
    const target = new URL(base + path);
    for (const [key, value] of Object.entries(query)) if (value != null) target.searchParams.set(key, value);
    return target;
  }

  async function call(path, { method = "POST", body, token, query } = {}) {
    // The key goes in apikey only: Supabase's newer publishable keys are not JWTs,
    // so Authorization carries nothing but a signed-in user's own access token.
    const headers = { apikey: anonKey };
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    let response;
    try {
      response = await fetch(endpoint(path, query), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      return { ok: false, status: 0, error: "unavailable" };
    }
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return response.ok ? { ok: true, data } : { ok: false, status: response.status, error: errorCode(response.status, data) };
  }

  return {
    signUp: ({ email, password, redirectTo }) =>
      call("/signup", { query: { redirect_to: redirectTo }, body: { email, password } }),
    signInWithPassword: ({ email, password }) =>
      call("/token", { query: { grant_type: "password" }, body: { email, password } }),
    exchangeCode: ({ code, verifier }) =>
      call("/token", { query: { grant_type: "pkce" }, body: { auth_code: code, code_verifier: verifier } }),
    // Where the browser goes to sign in with a provider; Supabase comes back to
    // redirectTo with ?code= (or ?error=).
    authorizeUrl: ({ provider, redirectTo, codeChallenge }) =>
      endpoint("/authorize", {
        provider,
        redirect_to: redirectTo,
        code_challenge: codeChallenge,
        code_challenge_method: "s256",
      }).toString(),
    verifyEmailLink: ({ tokenHash, type }) => call("/verify", { body: { token_hash: tokenHash, type } }),
    recover: ({ email, redirectTo }) => call("/recover", { query: { redirect_to: redirectTo }, body: { email } }),
    updateUser: (accessToken, attributes) => call("/user", { method: "PUT", token: accessToken, body: attributes }),
    signOut: (accessToken) => call("/logout", { token: accessToken, query: { scope: "local" } }),
    getUser: (accessToken) => call("/user", { method: "GET", token: accessToken }),
    refreshSession: (refreshToken) =>
      call("/token", { query: { grant_type: "refresh_token" }, body: { refresh_token: refreshToken } }),
  };
}
