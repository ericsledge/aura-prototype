// Simple line-art silhouettes so "3/4 or side" and "full-body" aren't left
// to the imagination — standardized capture is measurement infrastructure,
// not just a nicety, since inconsistent framing directly adds score noise.

type SilhouetteKind = "front" | "three_quarter" | "full_body";

const PATHS: Record<SilhouetteKind, React.ReactNode> = {
  front: (
    <>
      <circle cx="32" cy="18" r="10" />
      <path d="M14 54c0-12 8-20 18-20s18 8 18 20" />
    </>
  ),
  three_quarter: (
    <>
      <ellipse cx="30" cy="18" rx="8" ry="10" />
      <path d="M12 54c1-12 9-20 19-19s17 9 17 19" />
    </>
  ),
  full_body: (
    <>
      <circle cx="32" cy="10" r="7" />
      <path d="M32 17v20" />
      <path d="M32 20c-8 0-13 5-14 14M32 20c8 0 13 5 14 14" />
      <path d="M26 37l-3 20M38 37l3 20" />
    </>
  ),
};

export function CaptureSilhouette({ kind }: { kind: SilhouetteKind }) {
  return (
    <svg viewBox="0 0 64 64" width="48" height="48" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[kind]}
    </svg>
  );
}
