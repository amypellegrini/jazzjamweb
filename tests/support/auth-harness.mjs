// Runs the real Worker (worker/index.mjs) in Node for the Playwright auth tests,
// with a fake Supabase in place of the real one, since CI can't reach Supabase.
//
//   http://localhost:8788/__fake-supabase/…  the fake Supabase Auth API (and its
//                                            /__control test hooks)
//   http://localhost:8788/…                  everything else goes to the Worker,
//                                            whose static assets are proxied from
//                                            the Eleventy dev server on :8080
//
// The fake asks for email confirmation on sign-up, as a new Supabase project does.
import http from "node:http";
import { handleRequest } from "../../worker/index.mjs";
import { createFakeSupabase, FAKE_ANON_KEY } from "./fake-supabase.mjs";

const PORT = Number(process.env.AUTH_HARNESS_PORT ?? 8788);
const ELEVENTY = process.env.ELEVENTY_URL ?? "http://localhost:8080";
const ORIGIN = `http://localhost:${PORT}`;
const FAKE_BASE = "/__fake-supabase";

const supabase = createFakeSupabase({ basePath: FAKE_BASE, confirmEmail: true });

const env = {
  SUPABASE_URL: `${ORIGIN}${FAKE_BASE}`,
  SUPABASE_ANON_KEY: FAKE_ANON_KEY,
  ASSETS: {
    fetch: async (request) => {
      const { pathname, search } = new URL(request.url);
      return fetch(`${ELEVENTY}${pathname}${search}`, {
        method: request.method,
        headers: { accept: request.headers.get("accept") ?? "*/*" },
        redirect: "manual",
      });
    },
  },
};

// The Worker's own calls to the fake stay in-process.
const workerFetch = (input, init) => {
  const request = new Request(input, init);
  return new URL(request.url).pathname.startsWith(FAKE_BASE) ? supabase.handle(request) : fetch(request);
};

async function toRequest(incoming) {
  const chunks = [];
  for await (const chunk of incoming) chunks.push(chunk);
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(name, v));
    else if (value !== undefined) headers.set(name, value);
  }
  const hasBody = !["GET", "HEAD"].includes(incoming.method);
  return new Request(`${ORIGIN}${incoming.url}`, {
    method: incoming.method,
    headers,
    body: hasBody ? Buffer.concat(chunks) : undefined,
    redirect: "manual",
  });
}

async function send(outgoing, response) {
  const headers = {};
  response.headers.forEach((value, name) => {
    if (name !== "set-cookie" && name !== "content-encoding" && name !== "content-length") headers[name] = value;
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) headers["set-cookie"] = cookies;
  const body = Buffer.from(await response.arrayBuffer());
  outgoing.writeHead(response.status, headers);
  outgoing.end(body);
}

http
  .createServer(async (incoming, outgoing) => {
    try {
      const request = await toRequest(incoming);
      const response = new URL(request.url).pathname.startsWith(FAKE_BASE)
        ? await supabase.handle(request)
        : await handleRequest(request, env, { fetch: workerFetch });
      await send(outgoing, response);
    } catch (error) {
      outgoing.writeHead(500, { "content-type": "text/plain" });
      outgoing.end(String(error?.stack ?? error));
    }
  })
  .listen(PORT, () => console.log(`auth harness on ${ORIGIN}`));
