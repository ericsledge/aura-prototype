"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

// True only once the component has mounted in the browser. Lets pages read
// browser-only state (localStorage-backed store, in our case) directly in the
// render body — server and first client paint both render `false`/loading,
// avoiding a hydration mismatch — without stashing the read in a useEffect,
// which the stricter React Compiler lint rules flag as a smell for a plain
// synchronous read of an already-available store.
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
