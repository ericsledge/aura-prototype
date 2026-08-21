"use client";

import { useCallback, useEffect, useState } from "react";

interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches real (Supabase) data on mount and whenever `deps` change. This is
 * the legitimate use of setState-in-an-effect: genuine async I/O, not a
 * synchronous read of something already available (contrast with the old
 * useHydrated pattern from the localStorage era) — setState happens inside
 * the .then()/.catch() callback, not synchronously in the effect body.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[]): AsyncState<T> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: undefined, loading: true, error: null });
  const [refetchKey, setRefetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((e: Error) => {
        if (!cancelled) setState({ data: undefined, loading: false, error: e.message });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally controlled by caller
  }, [...deps, refetchKey]);

  const refetch = useCallback(() => setRefetchKey((k) => k + 1), []);

  return { ...state, refetch };
}
