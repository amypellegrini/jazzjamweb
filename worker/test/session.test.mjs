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
