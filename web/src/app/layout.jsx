import './globals.css'
import RegisterSW from './register-sw'
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/supabase/config'

export const metadata = {
  title: 'TERMINAL X',
  description: 'Personal Bloomberg-style stock terminal',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'TERMINAL X' },
  icons: { icon: '/favicon.svg', apple: '/icons/icon-192.png' },
}

export const viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  // Inject the public Supabase config (URL + anon key are safe to expose) so the
  // browser client works no matter which env-var names the host used.
  const sb = JSON.stringify({ url: getSupabaseUrl() || '', anonKey: getSupabaseAnonKey() || '' })
  return (
    <html lang="en">
      <body>
        <script dangerouslySetInnerHTML={{ __html: `window.__SB__=${sb}` }} />
        {children}
        <RegisterSW />
      </body>
    </html>
  )
}
