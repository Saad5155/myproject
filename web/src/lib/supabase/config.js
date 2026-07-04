// Resolve Supabase connection settings from whatever env-var names the host set.
// The Vercel↔Supabase integration, local .env, and manual setup all use slightly
// different names — we accept them all so the app "just works" after deploy.

const URL_CANDIDATES = [
  'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL', 'SUPABASE_SUPABASE_URL',
  'STORAGE_NEXT_PUBLIC_SUPABASE_URL', 'STORAGE_SUPABASE_URL', 'POSTGRES_SUPABASE_URL',
]
const ANON_CANDIDATES = [
  'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_SUPABASE_ANON_KEY',
  'STORAGE_NEXT_PUBLIC_SUPABASE_ANON_KEY', 'STORAGE_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_PUBLISHABLE_KEY',
]
const SERVICE_CANDIDATES = [
  'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SUPABASE_SERVICE_ROLE_KEY',
  'STORAGE_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY',
]

function resolve(candidates, suffixRe, excludeRe) {
  for (const k of candidates) if (process.env[k]) return process.env[k]
  // Fallback: scan all env vars for a matching suffix (works in the Node runtime;
  // Edge may not enumerate, which is why the explicit candidate list comes first).
  try {
    const hits = Object.keys(process.env).filter(
      (k) => suffixRe.test(k) && process.env[k] && (!excludeRe || !excludeRe.test(k))
    )
    hits.sort((a, b) => a.length - b.length) // prefer the least-prefixed name
    if (hits.length) return process.env[hits[0]]
  } catch { /* enumeration unsupported here */ }
  return undefined
}

export const getSupabaseUrl = () => resolve(URL_CANDIDATES, /SUPABASE_URL$/i, /POSTGRES/i)
export const getSupabaseAnonKey = () => resolve(ANON_CANDIDATES, /(SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY)$/i)
export const getSupabaseServiceKey = () => resolve(SERVICE_CANDIDATES, /SERVICE_ROLE_KEY$/i)
export const supabaseConfigured = () => !!(getSupabaseUrl() && getSupabaseAnonKey())
