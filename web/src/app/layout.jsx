import './globals.css'
import RegisterSW from './register-sw'

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
  return (
    <html lang="en">
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  )
}
