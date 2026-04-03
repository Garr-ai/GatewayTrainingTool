/**
 * Computes the callback URL used by Supabase auth flows.
 *
 * Optional env var `VITE_AUTH_REDIRECT_URL` can force a fixed base URL
 * (useful in local dev when external auth providers default to production).
 * Falls back to the current browser origin.
 */
export function buildAuthRedirectUrl(path: string): string {
  const baseFromEnv = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim()
  const base = baseFromEnv && baseFromEnv.length > 0
    ? baseFromEnv
    : window.location.origin

  return new URL(path, ensureTrailingSlash(base)).toString()
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`
}
