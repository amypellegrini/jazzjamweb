// The jazzjam.app Worker: the auth routes under /auth/, and the Eleventy build
// (the static assets binding) for everything else.
import { handleAuth } from "./auth.mjs";

export async function handleRequest(request, env, { fetch = globalThis.fetch } = {}) {
  const { pathname } = new URL(request.url);
  if (pathname.startsWith("/auth/")) return handleAuth(request, env, { fetch });
  return env.ASSETS.fetch(request);
}

export default {
  fetch: (request, env) => handleRequest(request, env),
};
