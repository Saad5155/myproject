import { createServerClient } from '@supabase/ssr'
import { createClient as createSbClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Request-scoped server client bound to the auth cookie (respects RLS as the user).
export function createServerSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(list) {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
          catch { /* called from a Server Component; middleware refreshes instead */ }
        },
      },
    }
  )
}

// Service-role client — bypasses RLS. ONLY use server-side for the shared quote_cache.
export function createServiceSupabase() {
  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// Helper: return the authenticated user or null.
export async function getUser() {
  if (process.env.DEMO_MODE === 'true') return { id: '00000000-0000-0000-0000-00000000demo', email: 'demo@terminal-x' }
  const sb = createServerSupabase()
  const { data } = await sb.auth.getUser()
  return data?.user || null
}
