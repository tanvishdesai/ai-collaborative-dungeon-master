"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

// Pages where a back button makes no sense (top-level / entry screens).
const HIDDEN_ON = new Set(["/", "/auth/login", "/auth/register"]);

export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (HIDDEN_ON.has(pathname)) return null;

  function goBack() {
    // Use browser history when we have it; fall back to the dashboard when the
    // page was opened directly (e.g. a shared link) and there's nothing to pop.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  // Sticky bar (not fixed) so it reserves layout space and never overlaps a
  // page's own header, while staying reachable as you scroll.
  return (
    <div className="sticky top-0 z-50 border-b border-border/60 bg-background/80 px-3 py-2 backdrop-blur">
      <button
        type="button"
        onClick={goBack}
        aria-label="Go back"
        className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
    </div>
  );
}
