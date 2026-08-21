"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Ensures the current browser has a real Supabase user — silently, with no
 * signup screen. Anonymous accounts are real `auth.users` rows (RLS works
 * against them exactly like any other user), just without an email/password.
 * Returns the user id.
 */
export async function ensureSession(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) return data.user.id;

  const { data: signInData, error } = await supabase.auth.signInAnonymously();
  if (error || !signInData.user) {
    throw new Error(error?.message ?? "anonymous_signin_failed");
  }
  return signInData.user.id;
}
