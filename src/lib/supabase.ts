import { createBrowserClient } from '@supabase/ssr'

// Browser-side Supabase client — used in all client components ('use client')
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
