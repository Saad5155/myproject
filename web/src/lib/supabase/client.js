'use client'
import { createBrowserClient } from '@supabase/ssr'

// Browser Supabase client (anon key — safe to expose; RLS enforces row access).
// Config is injected at runtime by the root layout as window.__SB__, so the
// browser works no matter which env-var names the host used (no build-time
// NEXT_PUBLIC_ dependency). Falls back to NEXT_PUBLIC_ vars for local dev.
export function createClient() {
  const cfg = (typeof window !== 'undefined' && window.__SB__) || {}
  const url = cfg.url || process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = cfg.anonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return createBrowserClient(url, anon)
}
