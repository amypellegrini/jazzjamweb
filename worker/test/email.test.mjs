import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, location } from "./helpers.mjs";

const EMAIL = "new.student@example.com";
const PASSWORD = "a long enough password";

test("signing up where Supabase issues a session at once signs the visitor in", async () => {
  const { request, session } = setup({ confirmEmail: false });
  const response = await request("/auth/sign-up", { method: "POST", form: { email: EMAIL, password: PASSWORD } });
  assert.equal(response.status, 303);
  assert.equal(location(response).pathname, "/account/");
  assert.deepEqual(await session(), { signedIn: true, user: { email: EMAIL } });
});

test("signing up where Supabase asks for confirmation sends the visitor to check their email", async () => {
  const { request, session, supabase } = setup({ confirmEmail: true });
  const response = await request("/auth/sign-up", { method: "POST", form: { email: EMAIL, password: PASSWORD } });
  assert.equal(response.status, 303);
  const to = location(response);
  assert.equal(to.pathname, "/account/sign-up/");
  assert.equal(to.searchParams.get("notice"), "check_email");
  assert.deepEqual(await session(), { signedIn: false });
  // The confirmation link comes back to this Worker.
  assert.equal(supabase.latestEmail(EMAIL).redirect_to, "https://jazzjam.app/auth/confirm");
});

test("the confirmation link signs the new student in", async () => {
  const { request, session, supabase } = setup({ confirmEmail: true });
  await request("/auth/sign-up", { method: "POST", form: { email: EMAIL, password: PASSWORD } });
  const { token_hash: tokenHash } = supabase.latestEmail(EMAIL);

  const response = await request(`/auth/confirm?token_hash=${tokenHash}&type=email`);
  assert.equal(response.status, 303);
  assert.equal(location(response).pathname, "/account/");
  assert.deepEqual(await session(), { signedIn: true, user: { email: EMAIL } });
});

test("an expired or reused confirmation link explains itself on the sign-in page", async () => {
  const { request, session } = setup();
  const response = await request("/auth/confirm?token_hash=nope&type=email");
  const to = location(response);
  assert.equal(to.pathname, "/account/sign-in/");
  assert.equal(to.searchParams.get("error"), "link_expired");
  assert.deepEqual(await session(), { signedIn: false });
});

test("sign-up errors go back to the form with a code the page explains", async () => {
  const { request, supabase } = setup();
  supabase.addUser(EMAIL, PASSWORD);
  const taken = await request("/auth/sign-up", { method: "POST", form: { email: EMAIL, password: PASSWORD } });
  assert.equal(location(taken).searchParams.get("error"), "email_taken");
  const weak = await request("/auth/sign-up", { method: "POST", form: { email: "x@example.com", password: "123" } });
  assert.equal(location(weak).pathname, "/account/sign-up/");
  assert.equal(location(weak).searchParams.get("error"), "weak_password");
});

test("signing in with the right password signs the student in", async () => {
  const { request, session, supabase } = setup();
  supabase.addUser(EMAIL, PASSWORD);
  const response = await request("/auth/sign-in", { method: "POST", form: { email: EMAIL, password: PASSWORD } });
  assert.equal(response.status, 303);
  assert.equal(location(response).pathname, "/account/");
  assert.deepEqual(await session(), { signedIn: true, user: { email: EMAIL } });
});

test("signing in returns to the page the student came from, but only on this site", async () => {
  const { request, supabase } = setup();
  supabase.addUser(EMAIL, PASSWORD);
  const back = await request("/auth/sign-in", {
    method: "POST",
    form: { email: EMAIL, password: PASSWORD, next: "/courses/block-chords/" },
  });
  assert.equal(location(back).href, "https://jazzjam.app/courses/block-chords/");
  for (const next of ["https://evil.example/", "//evil.example/", "/\\evil.example/", "/\t/evil.example/", "/\n/evil.example/", "/x\r\nSet-Cookie: a=b"]) {
    const response = await request("/auth/sign-in", { method: "POST", form: { email: EMAIL, password: PASSWORD, next } });
    assert.equal(location(response).href, "https://jazzjam.app/account/", next);
  }
});

test("a wrong password goes back to the sign-in form, signed out", async () => {
  const { request, session, supabase } = setup();
  supabase.addUser(EMAIL, PASSWORD);
  const response = await request("/auth/sign-in", { method: "POST", form: { email: EMAIL, password: "wrong" } });
  const to = location(response);
  assert.equal(to.pathname, "/account/sign-in/");
  assert.equal(to.searchParams.get("error"), "invalid_credentials");
  assert.deepEqual(await session(), { signedIn: false });
});

test("the session cookies are HttpOnly, Secure, SameSite=Lax and outlive the browser", async () => {
  const { request, supabase } = setup();
  supabase.addUser(EMAIL, PASSWORD);
  const response = await request("/auth/sign-in", { method: "POST", form: { email: EMAIL, password: PASSWORD } });
  const cookies = response.headers.getSetCookie();
  for (const name of ["jj_at", "jj_rt"]) {
    const cookie = cookies.find((c) => c.startsWith(`${name}=`));
    assert.ok(cookie, `${name} is set`);
    assert.match(cookie, /; HttpOnly/);
    assert.match(cookie, /; Secure/);
    assert.match(cookie, /; SameSite=Lax/);
    assert.match(cookie, /; Path=\//);
    const maxAge = Number(cookie.match(/Max-Age=(\d+)/)?.[1]);
    assert.ok(maxAge >= 30 * 24 * 60 * 60, `${name} is persistent (Max-Age ${maxAge})`);
  }
});

test("refuses a form posted from another site", async () => {
  const { request, supabase } = setup();
  supabase.addUser(EMAIL, PASSWORD);
  for (const headers of [{ origin: "https://evil.example" }, { "sec-fetch-site": "cross-site" }]) {
    const response = await request("/auth/sign-in", {
      method: "POST",
      form: { email: EMAIL, password: PASSWORD },
      headers,
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers.getSetCookie().length, 0);
  }
});

test("sign-in says the service is unavailable when Supabase is not configured", async () => {
  const { env, request } = setup();
  delete env.SUPABASE_ANON_KEY;
  const response = await request("/auth/sign-in", { method: "POST", form: { email: EMAIL, password: PASSWORD } });
  assert.equal(location(response).searchParams.get("error"), "unavailable");
});
