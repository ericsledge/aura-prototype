// Server-side Supabase client for Server Components / Route Handlers / Server
// Actions. Reads the user's session from cookies. Never import this into a
// "use client" file.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component with no writable cookie store
            // (e.g. during static rendering) — safe to ignore; middleware/proxy
            // refreshes the session on the next request instead.
          }
        },
      },
    }
  );
}
