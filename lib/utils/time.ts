// Plain utility (not a component/hook), so calling Date.now() here is a normal
// function call from React's perspective rather than an impure read during
// render — kept out of component bodies on purpose.
export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}
