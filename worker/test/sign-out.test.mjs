import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, location } from "./helpers.mjs";

const EMAIL = "student@example.com";

async function signedIn() {
  const context = setup();
  context.supabase.addUser(EMAIL, "correct horse");
  await context.request("/auth/sign-in", { method: "POST", form: { email: EMAIL, password: "correct horse" } });
  return context;
}

test("signing out clears the session and returns to the page the student was on", async () => {
  const { request, session, jar } = await signedIn();
  const response = await request("/auth/sign-out", { method: "POST", form: { next: "/courses/block-chords/" } });
  assert.equal(response.status, 303);
  assert.equal(location(response).href, "https://jazzjam.app/courses/block-chords/");
  assert.equal(jar.has("jj_at"), false);
  assert.equal(jar.has("jj_rt"), false);
  assert.deepEqual(await session(), { signedIn: false });
});

test("signing out revokes the session at Supabase, so a copied cookie stops working", async () => {
  const { request, jar, session } = await signedIn();
  const copied = { access: jar.get("jj_at"), refresh: jar.get("jj_rt") };
  await request("/auth/sign-out", { method: "POST", form: {} });
  jar.set("jj_at", copied.access);
  jar.set("jj_rt", copied.refresh);
  assert.deepEqual(await session(), { signedIn: false });
});

test("signing out goes home when there is no page to return to, or it is off-site", async () => {
  for (const next of [undefined, "https://evil.example/"]) {
    const { request } = await signedIn();
    const response = await request("/auth/sign-out", { method: "POST", form: next ? { next } : {} });
    assert.equal(location(response).href, "https://jazzjam.app/");
  }
});

test("signing out still clears the cookies when Supabase is unreachable", async () => {
  const { request, jar, env } = await signedIn();
  env.SUPABASE_URL = "https://down.supabase.test";
  await request("/auth/sign-out", { method: "POST", form: {} });
  assert.equal(jar.has("jj_at"), false);
  assert.equal(jar.has("jj_rt"), false);
});

test("signing out after the access token expired still revokes the session", async () => {
  const { request, jar, session, supabase } = await signedIn();
  supabase.expireAccessTokens();
  const copiedRefresh = jar.get("jj_rt");
  await request("/auth/sign-out", { method: "POST", form: {} });
  jar.set("jj_rt", copiedRefresh);
  assert.deepEqual(await session(), { signedIn: false });
});
