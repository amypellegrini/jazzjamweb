// The auth routes the site's account pages and header talk to. The browser never
// sees a Supabase token: they live in HttpOnly cookies set here, and pages learn
// who is signed in from GET /auth/session. Forms post here and get a 303 back to
// a page, with ?error=<code> or ?notice=<code> for src/assets/js/account-forms.js
// to put into words.
import { clearCookie, parseCookies, serializeCookie } from "./cookies.mjs";
import { createPkcePair } from "./pkce.mjs";
import { createSupabaseAuth } from "./supabase.mjs";

export const COOKIES = { access: "jj_at", refresh: "jj_rt", pkce: "jj_pkce" };

// Long enough to get through Google's consent screen.
const PKCE_MAX_AGE = 600;

// How long a signed-in browser stays signed in without coming back. Every visit
// that refreshes the session starts the clock again.
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const PAGES = {
  account: "/account/",
  signIn: "/account/sign-in/",
  signUp: "/account/sign-up/",
  forgotPassword: "/account/forgot-password/",
  resetPassword: "/account/reset-password/",
};

// The Supabase email-link types /auth/confirm accepts (docs/supabase-setup.md has
// the email templates that produce the links), and the page each one lands on.
const EMAIL_LINK_LANDING = {
  email: PAGES.account,
  signup: PAGES.account,
  recovery: PAGES.resetPassword,
};

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...init.headers },
  });
}

function redirect(to, cookies = []) {
  const response = new Response(null, { status: 303, headers: { location: to, "cache-control": "no-store" } });
  for (const cookie of cookies) response.headers.append("set-cookie", cookie);
  return response;
}

function withQuery(path, params) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value));
  return query.size ? `${path}?${query}` : path;
}

// Only a path on this site: never another origin, nor a protocol-relative URL.
// Control characters are refused outright: browsers strip tabs and newlines when
// they read a Location header, so "/\t/evil.example" would arrive as
// "//evil.example", and a CR or LF would break the header itself.
const SAME_SITE_BASE = "https://same-site.invalid";
export function safeNext(value, fallback = PAGES.account) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\x00-\x1f\x7f]/.test(value)
  ) {
    return fallback;
  }
  const resolved = new URL(value, SAME_SITE_BASE);
  if (resolved.origin !== SAME_SITE_BASE) return fallback;
  return resolved.pathname + resolved.search + resolved.hash;
}

function sessionCookies(session) {
  return [
    serializeCookie(COOKIES.access, session.access_token, { maxAge: SESSION_MAX_AGE }),
    serializeCookie(COOKIES.refresh, session.refresh_token, { maxAge: SESSION_MAX_AGE }),
  ];
}

// A form post from another site (login CSRF) is refused before it reaches Supabase.
function crossSite(request, url) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return true;
  const origin = request.headers.get("origin");
  return Boolean(origin) && origin !== url.origin;
}

async function form(request) {
  try {
    const data = await request.formData();
    return Object.fromEntries([...data].map(([key, value]) => [key, typeof value === "string" ? value : ""]));
  } catch {
    return {};
  }
}

function clearSessionCookies() {
  return [clearCookie(COOKIES.access), clearCookie(COOKIES.refresh)];
}

// The signed-in user behind the request's cookies (user null when there is none),
// with the access token that proved it. An access token lasts an hour; after that
// the refresh token gets a new pair, which is what keeps a student signed in
// across browser restarts. Cookies to send back ride along in setCookies.
const TOKEN_REJECTED = new Set([400, 401, 403]);
async function currentUser(supabase, cookies) {
  const access = cookies[COOKIES.access];
  const refresh = cookies[COOKIES.refresh];
  if (access) {
    const result = await supabase.getUser(access);
    if (result.ok) return { user: result.data, access, setCookies: [] };
  }
  let rejected = Boolean(access) && !refresh;
  if (refresh) {
    const result = await supabase.refreshSession(refresh);
    if (result.ok) {
      return { user: result.data.user, access: result.data.access_token, setCookies: sessionCookies(result.data) };
    }
    // Only Supabase turning the token down ends the session; an outage (no answer,
    // or a 5xx) or a rate limit (429) leaves the cookies for the next visit to try again.
    rejected = TOKEN_REJECTED.has(result.status);
  }
  return { user: null, access: null, setCookies: rejected ? clearSessionCookies() : [] };
}

const routes = {
  "GET /auth/session": async ({ supabase, cookies }) => {
    if (!supabase) return json({ signedIn: false });
    const { user, setCookies } = await currentUser(supabase, cookies);
    const response = json(user ? { signedIn: true, user: { email: user.email } } : { signedIn: false });
    for (const cookie of setCookies) response.headers.append("set-cookie", cookie);
    return response;
  },

  "POST /auth/sign-up": async ({ request, url, supabase }) => {
    const { email, password, next } = await form(request);
    if (!supabase) return redirect(withQuery(PAGES.signUp, { error: "unavailable" }));
    const result = await supabase.signUp({ email, password, redirectTo: `${url.origin}/auth/confirm` });
    if (!result.ok) return redirect(withQuery(PAGES.signUp, { error: result.error, next }));
    // With "Confirm email" on (Supabase's default) there is no session until the
    // emailed link comes back to /auth/confirm.
    if (!result.data?.access_token) return redirect(withQuery(PAGES.signUp, { notice: "check_email" }));
    return redirect(safeNext(next), sessionCookies(result.data));
  },

  "POST /auth/sign-in": async ({ request, supabase }) => {
    const { email, password, next } = await form(request);
    if (!supabase) return redirect(withQuery(PAGES.signIn, { error: "unavailable" }));
    const result = await supabase.signInWithPassword({ email, password });
    if (!result.ok) return redirect(withQuery(PAGES.signIn, { error: result.error, next }));
    return redirect(safeNext(next), sessionCookies(result.data));
  },

  "GET /auth/google": async ({ url, supabase }) => {
    if (!supabase) return redirect(withQuery(PAGES.signIn, { error: "unavailable" }));
    const { verifier, challenge } = await createPkcePair();
    const next = safeNext(url.searchParams.get("next"));
    const to = supabase.authorizeUrl({
      provider: "google",
      redirectTo: `${url.origin}/auth/callback`,
      codeChallenge: challenge,
    });
    const response = new Response(null, { status: 302, headers: { location: to, "cache-control": "no-store" } });
    const value = `${verifier}|${encodeURIComponent(next)}`;
    response.headers.append("set-cookie", serializeCookie(COOKIES.pkce, value, { maxAge: PKCE_MAX_AGE }));
    return response;
  },

  "GET /auth/callback": async ({ url, supabase, cookies }) => {
    const clearPkce = clearCookie(COOKIES.pkce);
    const [verifier, encodedNext] = (cookies[COOKIES.pkce] ?? "").split("|");
    const code = url.searchParams.get("code");
    if (!supabase || !code || !verifier) {
      return redirect(withQuery(PAGES.signIn, { error: supabase ? "oauth_failed" : "unavailable" }), [clearPkce]);
    }
    const result = await supabase.exchangeCode({ code, verifier });
    if (!result.ok) return redirect(withQuery(PAGES.signIn, { error: "oauth_failed" }), [clearPkce]);
    const next = safeNext(decodeURIComponent(encodedNext ?? ""));
    return redirect(next, [clearPkce, ...sessionCookies(result.data)]);
  },

  "GET /auth/confirm": async ({ url, supabase }) => {
    const tokenHash = url.searchParams.get("token_hash");
    const type = url.searchParams.get("type");
    if (!supabase) return redirect(withQuery(PAGES.signIn, { error: "unavailable" }));
    const expired = redirect(withQuery(PAGES.signIn, { error: "link_expired" }));
    if (!tokenHash || !Object.hasOwn(EMAIL_LINK_LANDING, type)) return expired;
    const result = await supabase.verifyEmailLink({ tokenHash, type });
    if (!result.ok) return expired;
    return redirect(EMAIL_LINK_LANDING[type], sessionCookies(result.data));
  },

  "POST /auth/sign-out": async ({ request, supabase, cookies }) => {
    const { next } = await form(request);
    // Revoke the session at Supabase too, so a copied cookie stops working (with a
    // fresh access token if the old one has expired). Best effort: the browser's
    // cookies go either way.
    if (supabase) {
      const { access } = await currentUser(supabase, cookies);
      if (access) await supabase.signOut(access);
    }
    return redirect(safeNext(next, "/"), clearSessionCookies());
  },

  // Always the same answer, so the form can't be used to find out who has an account.
  "POST /auth/forgot-password": async ({ request, url, supabase }) => {
    const { email } = await form(request);
    if (!supabase) return redirect(withQuery(PAGES.forgotPassword, { error: "unavailable" }));
    const result = await supabase.recover({ email, redirectTo: `${url.origin}/auth/confirm` });
    if (!result.ok && result.error === "rate_limited") {
      return redirect(withQuery(PAGES.forgotPassword, { error: "rate_limited" }));
    }
    return redirect(withQuery(PAGES.forgotPassword, { notice: "reset_sent" }));
  },

  "POST /auth/update-password": async ({ request, supabase, cookies }) => {
    const { password } = await form(request);
    if (!supabase) return redirect(withQuery(PAGES.resetPassword, { error: "unavailable" }));
    const { user, access, setCookies } = await currentUser(supabase, cookies);
    if (!user) return redirect(withQuery(PAGES.forgotPassword, { error: "link_expired" }), setCookies);
    const result = await supabase.updateUser(access, { password });
    if (!result.ok) return redirect(withQuery(PAGES.resetPassword, { error: result.error }), setCookies);
    return redirect(withQuery(PAGES.account, { notice: "password_updated" }), setCookies);
  },
};

export async function handleAuth(request, env, { fetch }) {
  const url = new URL(request.url);
  const route = routes[`${request.method} ${url.pathname}`];
  if (!route) return new Response("Not found", { status: 404 });
  if (request.method === "POST" && crossSite(request, url)) return new Response("Forbidden", { status: 403 });
  const supabase =
    env.SUPABASE_URL && env.SUPABASE_ANON_KEY
      ? createSupabaseAuth({ url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY, fetch })
      : null;
  return route({ request, url, env, supabase, cookies: parseCookies(request.headers.get("cookie")) });
}
