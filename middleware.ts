import { NextRequest, NextResponse } from 'next/server'

/**
 * Route protection + root redirect middleware.
 * Protected routes (/dashboard, /history) require munafa_vendor_id cookie.
 * Auth route (/onboarding) redirects to dashboard if already authenticated.
 * Root (/) redirects based on session — avoids heavy next/headers in page.tsx.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const vendorId = req.cookies.get('munafa_vendor_id')?.value

  // Root redirect — send to dashboard if logged in, else onboarding
  if (pathname === '/') {
    const url = req.nextUrl.clone()
    url.pathname = vendorId ? '/dashboard' : '/onboarding'
    return NextResponse.redirect(url)
  }

  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/history') ||
    pathname.startsWith('/catalogue')
  const isAuthRoute = pathname === '/onboarding'

  if (isProtected && !vendorId) {
    const url = req.nextUrl.clone()
    url.pathname = '/onboarding'
    return NextResponse.redirect(url)
  }

  if (isAuthRoute && vendorId) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/history/:path*', '/catalogue/:path*', '/onboarding'],
}
