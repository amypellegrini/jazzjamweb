// Shared setup for the Worker's unit tests: a Worker env wired to the in-memory
// fake Supabase, and helpers to carry cookies between requests like a browser.
import { handleRequest } from "../index.mjs";
import { createFakeSupabase, FAKE_ANON_KEY } from "../../tests/support/fake-supabase.mjs";

export const ORIGIN = "https://jazzjam.app";
export const SUPABASE_URL = "https://project.supabase.test";

export function setup(fakeOptions = {}) {
  const supabase = createFakeSupabase({ basePath: "", ...fakeOptions });
  const env = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY: FAKE_ANON_KEY,
    ASSETS: { fetch: async () => new Response("static page") },
  };
  // Supabase is reached through this fetch, so the tests never touch the network.
  const fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.origin !== SUPABASE_URL) throw new Error(`unexpected fetch to ${url}`);
    return supabase.fetch(input, init);
  };
  const jar = new Map();

  function cookieHeader() {
    return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  function storeCookies(response) {
    for (const line of response.headers.getSetCookie()) {
      const [pair, ...attributes] = line.split(";").map((part) => part.trim());
      const [name, value] = [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)];
      const maxAge = attributes.find((a) => a.toLowerCase().startsWith("max-age="));
      if (maxAge && Number(maxAge.split("=")[1]) <= 0) jar.delete(name);
      else jar.set(name, value);
    }
  }

  async function request(path, { method = "GET", form, headers = {} } = {}) {
    const init = { method, headers: { cookie: cookieHeader(), ...headers }, redirect: "manual" };
    if (form) {
      init.body = new URLSearchParams(form);
      init.headers["content-type"] = "application/x-www-form-urlencoded";
      init.headers.origin ??= ORIGIN;
    }
    const response = await handleRequest(new Request(new URL(path, ORIGIN), init), env, { fetch });
    storeCookies(response);
    return response;
  }

  async function session() {
    const response = await request("/auth/session");
    return response.json();
  }

  return { supabase, env, jar, request, session };
}

export function location(response) {
  const value = response.headers.get("location");
  return value && new URL(value, ORIGIN);
}
