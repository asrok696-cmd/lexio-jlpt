export const AUTH_COOKIE = "lexio.auth.v1";

export function isBrowser() {
  return typeof window !== "undefined";
}

export function setClientCookie(name: string, value: string, days = 30) {
  if (!isBrowser()) return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export function clearClientCookie(name: string) {
  if (!isBrowser()) return;
  document.cookie = `${encodeURIComponent(name)}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getClientCookie(name: string): string | null {
  if (!isBrowser()) return null;
  const cookies = document.cookie.split(";").map((s) => s.trim());
  for (const c of cookies) {
    const [k, ...rest] = c.split("=");
    if (decodeURIComponent(k) === name) return decodeURIComponent(rest.join("=") ?? "");
  }
  return null;
}

// dev stub login/logout
export function devLogin() {
  setClientCookie(AUTH_COOKIE, "1");
}

export function devLogout() {
  clearClientCookie(AUTH_COOKIE);
}