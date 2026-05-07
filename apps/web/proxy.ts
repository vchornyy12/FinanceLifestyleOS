import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  try {
    let supabaseResponse = NextResponse.next({
      request,
    })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            )
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options),
            )
          },
        },
      },
    )

    // Refresh the session — this keeps the user logged in and rotates tokens.
    // Do not remove this call; without it the server-side auth state goes stale.
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { pathname } = request.nextUrl

    // Unauthenticated users must not access protected routes.
    if (pathname.startsWith('/dashboard') && !user) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      return NextResponse.redirect(loginUrl)
    }

    // Authenticated users should not linger on auth pages.
    if ((pathname === '/login' || pathname === '/register') && user) {
      const dashboardUrl = request.nextUrl.clone()
      dashboardUrl.pathname = '/dashboard'
      return NextResponse.redirect(dashboardUrl)
    }

    // Redirect authenticated users who haven't completed onboarding.
    // Skip when already on /onboarding to prevent an infinite redirect loop.
    if (user && pathname.startsWith('/dashboard') && !pathname.startsWith('/onboarding')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single()

      if (profile && profile.onboarding_completed === false) {
        const onboardingUrl = request.nextUrl.clone()
        onboardingUrl.pathname = '/onboarding'
        return NextResponse.redirect(onboardingUrl)
      }
    }

    return supabaseResponse
  } catch (err) {
    // If the Supabase auth check fails (transient network error in the edge
    // runtime), pass the request through rather than crashing the edge
    // function. The API route and page handlers each re-validate auth
    // independently, so this fallback is safe.
    console.error('[proxy] auth check failed, passing through:', err)
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico, sitemap.xml, robots.txt (metadata)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
