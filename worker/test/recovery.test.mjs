import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, location } from "./helpers.mjs";

const EMAIL = "forgetful@example.com";

test("asking for a reset link says one was sent, whether or not the account exists", async () => {
  const { request, supabase } = setup();
  supabase.addUser(EMAIL, "old password");
  for (const email of [EMAIL, "nobody@example.com"]) {
    const response = await request("/auth/forgot-password", { method: "POST", form: { email } });
    assert.equal(response.status, 303);
    assert.equal(location(response).pathname, "/account/forgot-password/");
    assert.equal(location(response).searchParams.get("notice"), "reset_sent");
  }
  const sent = supabase.latestEmail(EMAIL);
  assert.equal(sent.type, "recovery");
  assert.equal(sent.redirect_to, "https://jazzjam.app/auth/confirm");
  assert.equal(supabase.latestEmail("nobody@example.com"), undefined);
});

test("the reset link signs the student in and asks for a new password", async () => {
  const { request, session, supabase, followEmailLink } = setup();
  supabase.addUser(EMAIL, "old password");
  await request("/auth/forgot-password", { method: "POST", form: { email: EMAIL } });
  const { token_hash: tokenHash } = supabase.latestEmail(EMAIL);

  const response = await followEmailLink(`/auth/confirm?token_hash=${tokenHash}&type=recovery`);
  assert.equal(location(response).pathname, "/account/reset-password/");
  assert.deepEqual(await session(), { signedIn: true, user: { email: EMAIL } });
});

test("setting the new password lets the student sign back in with it", async () => {
  const { request, supabase, jar, session, followEmailLink } = setup();
  supabase.addUser(EMAIL, "old password");
  await request("/auth/forgot-password", { method: "POST", form: { email: EMAIL } });
  await followEmailLink(`/auth/confirm?token_hash=${supabase.latestEmail(EMAIL).token_hash}&type=recovery`);

  const updated = await request("/auth/update-password", { method: "POST", form: { password: "brand new password" } });
  assert.equal(location(updated).pathname, "/account/");
  assert.equal(location(updated).searchParams.get("notice"), "password_updated");

  jar.clear();
  const old = await request("/auth/sign-in", { method: "POST", form: { email: EMAIL, password: "old password" } });
  assert.equal(location(old).searchParams.get("error"), "invalid_credentials");
  await request("/auth/sign-in", { method: "POST", form: { email: EMAIL, password: "brand new password" } });
  assert.deepEqual(await session(), { signedIn: true, user: { email: EMAIL } });
});

test("a too-short new password goes back to the reset form", async () => {
  const { request, supabase, followEmailLink } = setup();
  supabase.addUser(EMAIL, "old password");
  await request("/auth/forgot-password", { method: "POST", form: { email: EMAIL } });
  await followEmailLink(`/auth/confirm?token_hash=${supabase.latestEmail(EMAIL).token_hash}&type=recovery`);
  const response = await request("/auth/update-password", { method: "POST", form: { password: "123" } });
  assert.equal(location(response).pathname, "/account/reset-password/");
  assert.equal(location(response).searchParams.get("error"), "weak_password");
});

test("setting a password without a session sends the visitor to ask for a new link", async () => {
  const { request } = setup();
  const response = await request("/auth/update-password", { method: "POST", form: { password: "brand new password" } });
  assert.equal(location(response).pathname, "/account/forgot-password/");
  assert.equal(location(response).searchParams.get("error"), "link_expired");
});
