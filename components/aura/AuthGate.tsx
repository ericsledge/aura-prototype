"use client";

import { useEffect, useState } from "react";
import { ensureSession } from "@/lib/supabase/session";

// Establishes a real (anonymous) Supabase session before any page renders,
// so every data-layer call downstream can assume a signed-in user exists.
// This is the one legitimate place in the app for an effect that calls
// setState after an async operation — it's genuine I/O, not a synchronous
// read of something already available (contrast with useHydrated, which
// exists for the latter case).
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureSession()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-5 py-24 text-center">
        <p className="text-danger">Couldn&apos;t connect to Aura&apos;s servers.</p>
        <p className="text-sm text-muted">{error}</p>
        <button onClick={() => window.location.reload()} className="text-sm text-accent-soft hover:underline">
          Retry
        </button>
      </div>
    );
  }

  if (!ready) return null;

  return <>{children}</>;
}
