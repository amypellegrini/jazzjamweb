// PKCE (RFC 7636) for the Google sign-in: the Worker keeps the verifier, Supabase
// gets only its SHA-256 challenge, and the code Google's round trip returns is
// worthless without the verifier.
const encoder = new TextEncoder();

function base64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createPkcePair() {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier)));
  return { verifier, challenge: base64Url(digest) };
}
