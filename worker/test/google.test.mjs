import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, location, SUPABASE_URL } from "./helpers.mjs";

test("Continue with Google sends the browser to Supabase's Google sign-in with a PKCE challenge", async () => {
  const { request, jar } = setup();
  const response = await request("/auth/google");
  assert.equal(response.status, 302);
  const to = location(response);
  assert.equal(`${to.origin}${to.pathname}`, `${SUPABASE_URL}/auth/v1/authorize`);
  assert.equal(to.searchParams.get("provider"), "google");
  assert.equal(to.searchParams.get("redirect_to"), "https://jazzjam.app/auth/callback");
  assert.equal(to.searchParams.get("code_challenge_method"), "s256");
  assert.match(to.searchParams.get("code_challenge"), /^[A-Za-z0-9_-]{43}$/);
  // The verifier waits in a short-lived HttpOnly cookie for the callback.
  const verifier = response.headers.getSetCookie().find((c) => c.startsWith("jj_pkce="));
  assert.match(verifier, /; HttpOnly/);
  assert.match(verifier, /Max-Age=600/);
  assert.ok(jar.get("jj_pkce"));
});

test("coming back from Google signs the student in, creating the account the first time", async () => {
  const { request, session, supabase, jar } = setup({ googleEmail: "pianist@gmail.example" });
  const start = await request("/auth/google");
  // What a real browser does next: Supabase (here the fake) answers the authorize URL
  // by redirecting back to /auth/callback with a code.
  const authorize = await supabase.fetch(location(start), { redirect: "manual" });
  const callback = new URL(authorize.headers.get("location"));
  assert.equal(callback.pathname, "/auth/callback");

  const response = await request(`${callback.pathname}${callback.search}`);
  assert.equal(response.status, 303);
  assert.equal(location(response).pathname, "/account/");
  assert.deepEqual(await session(), { signedIn: true, user: { email: "pianist@gmail.example" } });
  assert.ok(supabase.users.has("pianist@gmail.example"));
  assert.equal(jar.has("jj_pkce"), false, "the verifier is used once, then cleared");
});

test("a callback without the browser's verifier does not sign anyone in", async () => {
  const { request, session, supabase, jar } = setup();
  const start = await request("/auth/google");
  const authorize = await supabase.fetch(location(start), { redirect: "manual" });
  const callback = new URL(authorize.headers.get("location"));
  jar.delete("jj_pkce");

  const response = await request(`${callback.pathname}${callback.search}`);
  assert.equal(location(response).pathname, "/account/sign-in/");
  assert.equal(location(response).searchParams.get("error"), "oauth_failed");
  assert.deepEqual(await session(), { signedIn: false });
});

test("a student who cancels on Google's screen lands back on sign-in", async () => {
  const { request } = setup();
  await request("/auth/google");
  const response = await request("/auth/callback?error=access_denied&error_description=cancelled");
  assert.equal(location(response).pathname, "/account/sign-in/");
  assert.equal(location(response).searchParams.get("error"), "oauth_failed");
});

test("a tampered verifier cookie fails the sign-in safely instead of crashing", async () => {
  const { request, session, supabase, jar } = setup();
  const start = await request("/auth/google");
  const authorize = await supabase.fetch(location(start), { redirect: "manual" });
  const callback = new URL(authorize.headers.get("location"));
  const [verifier] = decodeURIComponent(jar.get("jj_pkce")).split("|");
  jar.set("jj_pkce", `${verifier}%7C%25`);

  const response = await request(`${callback.pathname}${callback.search}`);
  assert.equal(response.status, 303);
  assert.equal(location(response).pathname, "/account/");
  assert.deepEqual(await session(), { signedIn: true, user: { email: "google.student@example.com" } });
});
