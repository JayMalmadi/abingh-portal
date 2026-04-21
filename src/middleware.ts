import { NextResponse, type NextRequest } from 'next/server'

// Auth is handled client-side in each page via Supabase useEffect
// This middleware only handles static asset passthrough
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
