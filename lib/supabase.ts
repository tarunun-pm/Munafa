import { createBrowserClient as _createBrowserClient } from '@supabase/ssr'

/**
 * Creates a Supabase browser client for use in Client Components.
 * Uses the publishable anon key — safe to expose in the browser.
 */
export function createBrowserClient() {
  return _createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
