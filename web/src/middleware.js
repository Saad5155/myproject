import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/supabase/config'

// Refreshes the Supabase session on every request and guards the app.
// Unauthenticated users are redirected to /login (except public paths + auth API).
export async function middleware(request) {
  // DEMO MODE: no Supabase, no auth — everything is canned and in-memory.
  if (process.env.DEMO_MODE === 'true') {
    if (request.nextUrl.pathname.startsWith('/login')) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
    return NextResponse.next({ request })
  }

  const supaUrl = getSupabaseUrl()
  const supaAnon = getSupabaseAnonKey()
  // Not configured yet (env vars missing) — don't 500. Let the request through
  // so the login page renders with a clear message instead of a crash.
  if (!supaUrl || !supaAnon) return NextResponse.next({ request })

  let response = NextResponse.next({ request })

  const supabase = createServerClient(supaUrl, supaAnon, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data?.user || null
  } catch {
    // transient auth/network error — don't hard-crash the whole site
    return NextResponse.next({ request })
  }

  const { pathname } = request.nextUrl
  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/sw.js' ||
    pathname.startsWith('/icons') ||
    pathname === '/favicon.svg'

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  if (user && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
