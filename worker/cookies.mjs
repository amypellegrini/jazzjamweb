// Reading the Cookie header and writing Set-Cookie lines for the session cookies.
export function parseCookies(header) {
  const cookies = {};
  for (const part of (header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    if (name && !(name in cookies)) cookies[name] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}

// HttpOnly keeps the tokens away from page scripts; Secure and SameSite=Lax keep
// them off plain HTTP and off cross-site POSTs. Browsers treat localhost as secure,
// so local development works over http too.
export function serializeCookie(name, value, { maxAge, path = "/" } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, "HttpOnly", "Secure", "SameSite=Lax"];
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  return parts.join("; ");
}

export function clearCookie(name, { path = "/" } = {}) {
  return serializeCookie(name, "", { maxAge: 0, path });
}
