// Browser-side Supabase client. Uses the public anon key only — safe to ship
// to the client. RLS policies (supabase/migrations/0001_init.sql) are what
// actually enforce per-user access, not this key.

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
