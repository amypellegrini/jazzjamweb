import { test } from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers.mjs";

test("a visitor with no session cookies is signed out", async () => {
  const { request } = setup();
  const response = await request("/auth/session");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { signedIn: false });
});

test("a visitor whose access token Supabase accepts is signed in as that user", async () => {
  const { supabase, jar, session } = setup();
  supabase.addUser("student@example.com", "correct horse");
  const signedIn = await supabase.fetch("https://x/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: "fake-anon-key" },
    body: JSON.stringify({ email: "student@example.com", password: "correct horse" }),
  }).then((r) => r.json());
  jar.set("jj_at", signedIn.access_token);
  jar.set("jj_rt", signedIn.refresh_token);

  assert.deepEqual(await session(), { signedIn: true, user: { email: "student@example.com" } });
});

test("reports signed out, rather than failing, when Supabase is not configured", async () => {
  const { env, request } = setup();
  delete env.SUPABASE_URL;
  const response = await request("/auth/session");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { signedIn: false });
});

test("unknown auth routes are not found", async () => {
  const { request } = setup();
  assert.equal((await request("/auth/nope")).status, 404);
});

test("a student whose access token has expired stays signed in on the refresh token", async () => {
  const { supabase, request, jar } = setup();
  supabase.addUser("student@example.com", "correct horse");
  await request("/auth/sign-in", { method: "POST", form: { email: "student@example.com", password: "correct horse" } });
  const before = { access: jar.get("jj_at"), refresh: jar.get("jj_rt") };
  supabase.expireAccessTokens();

  const response = await request("/auth/session");
  assert.deepEqual(await response.json(), { signedIn: true, user: { email: "student@example.com" } });
  // Supabase rotates the refresh token; the browser keeps the new pair.
  assert.notEqual(jar.get("jj_at"), before.access);
  assert.notEqual(jar.get("jj_rt"), before.refresh);
  const refreshed = response.headers.getSetCookie().find((c) => c.startsWith("jj_rt="));
  assert.match(refreshed, /Max-Age=\d+/);

  // ...and the new pair keeps working.
  const again = await request("/auth/session");
  assert.deepEqual(await again.json(), { signedIn: true, user: { email: "student@example.com" } });
});

test("a session Supabase no longer honours is signed out and its cookies cleared", async () => {
  const { request, jar } = setup();
  jar.set("jj_at", "revoked-access");
  jar.set("jj_rt", "revoked-refresh");
  const response = await request("/auth/session");
  assert.deepEqual(await response.json(), { signedIn: false });
  assert.equal(jar.has("jj_at"), false);
  assert.equal(jar.has("jj_rt"), false);
});

test("an outage at Supabase does not sign the student out for good", async () => {
  const { request, jar, env } = setup();
  jar.set("jj_at", "some-access");
  jar.set("jj_rt", "some-refresh");
  env.SUPABASE_URL = "https://down.supabase.test"; // the test fetch throws for any other host
  const response = await request("/auth/session");
  assert.deepEqual(await response.json(), { signedIn: false });
  assert.equal(jar.get("jj_rt"), "some-refresh");
});

test("a rate limit at Supabase does not sign the student out for good", async () => {
  const { request, jar, supabase } = setup();
  jar.set("jj_at", "some-access");
  jar.set("jj_rt", "some-refresh");
  supabase.fetch = async () =>
    new Response(JSON.stringify({ code: 429, error_code: "over_request_rate_limit" }), {
      status: 429,
      headers: { "content-type": "application/json" },
    });
  const response = await request("/auth/session");
  assert.deepEqual(await response.json(), { signedIn: false });
  assert.equal(jar.get("jj_rt"), "some-refresh");
});

test("a malformed cookie elsewhere on the site does not break the auth routes", async () => {
  const { request, jar } = setup();
  jar.set("someone_elses", "100%");
  const response = await request("/auth/session");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { signedIn: false });
});
