import { test } from "node:test";
import assert from "node:assert/strict";
import { createSupabaseAuth } from "../supabase.mjs";

function recordingFetch(status = 200, body = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url: new URL(url), init });
    return new Response(JSON.stringify(body), { status });
  };
  return { calls, fetch };
}

test("sends the project key as apikey, and a bearer token only for the user's own calls", async () => {
  const { calls, fetch } = recordingFetch();
  const auth = createSupabaseAuth({ url: "https://ref.supabase.co/", anonKey: "sb_publishable_x", fetch });
  await auth.signInWithPassword({ email: "a@example.com", password: "pw" });
  await auth.getUser("user-access-token");

  assert.equal(calls[0].url.href, "https://ref.supabase.co/auth/v1/token?grant_type=password");
  assert.equal(calls[0].init.headers.apikey, "sb_publishable_x");
  // Supabase's newer publishable keys are not JWTs, so the key never goes in Authorization.
  assert.equal(calls[0].init.headers.authorization, undefined);
  assert.equal(calls[1].init.headers.authorization, "Bearer user-access-token");
});

test("maps Supabase's error codes, old and new, onto the codes the pages explain", async () => {
  const cases = [
    [400, { error_code: "invalid_credentials" }, "invalid_credentials"],
    [400, { error: "invalid_grant", error_description: "Invalid login credentials" }, "invalid_credentials"],
    [422, { error_code: "user_already_exists" }, "email_taken"],
    [422, { error_code: "weak_password" }, "weak_password"],
    [422, { error_code: "same_password" }, "same_password"],
    [429, {}, "rate_limited"],
    [500, { msg: "boom" }, "unknown"],
  ];
  for (const [status, body, expected] of cases) {
    const auth = createSupabaseAuth({ url: "https://ref.supabase.co", anonKey: "k", fetch: recordingFetch(status, body).fetch });
    const result = await auth.signInWithPassword({ email: "a@example.com", password: "pw" });
    assert.deepEqual(result, { ok: false, status, error: expected }, JSON.stringify(body));
  }
});
