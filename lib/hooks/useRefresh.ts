"use client";

import { useCallback, useState } from "react";

// Bumps a counter to force a re-render after a store mutation (e.g. delete,
// start mission) so a component can re-read the store during render instead
// of caching a copy in state that could drift.
export function useRefresh(): [number, () => void] {
  const [key, setKey] = useState(0);
  const refresh = useCallback(() => setKey((k) => k + 1), []);
  return [key, refresh];
}
