// The auth routes the site's account pages and header talk to. The browser never
// sees a Supabase token: they live in HttpOnly cookies set here, and pages learn
// who is signed in from GET /auth/session.
import { parseCookies } from "./cookies.mjs";
import { createSupabaseAuth } from "./supabase.mjs";

export const COOKIES = { access: "jj_at", refresh: "jj_rt" };

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...init.headers },
  });
}

// The signed-in user behind the request's cookies, or null.
async function currentUser(supabase, cookies) {
  const access = cookies[COOKIES.access];
  if (!access) return null;
  const result = await supabase.getUser(access);
  return result.ok ? result.data : null;
}

const routes = {
  "GET /auth/session": async ({ supabase, cookies }) => {
    if (!supabase) return json({ signedIn: false });
    const user = await currentUser(supabase, cookies);
    return json(user ? { signedIn: true, user: { email: user.email } } : { signedIn: false });
  },
};

export async function handleAuth(request, env, { fetch }) {
  const url = new URL(request.url);
  const route = routes[`${request.method} ${url.pathname}`];
  if (!route) return new Response("Not found", { status: 404 });
  const supabase =
    env.SUPABASE_URL && env.SUPABASE_ANON_KEY
      ? createSupabaseAuth({ url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY, fetch })
      : null;
  return route({ request, url, env, supabase, cookies: parseCookies(request.headers.get("cookie")) });
}
