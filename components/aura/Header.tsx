"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Header() {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  return (
    <header className="sticky top-0 z-10 border-b border-border-subtle bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Aura
        </Link>
        {!isLanding && (
          <nav className="flex items-center gap-4 text-sm text-muted">
            <Link href="/journey" className="hover:text-foreground">
              Journey
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
