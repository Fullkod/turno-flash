import type { ReactNode } from "react";

/** "Desarrollado por Fullkod" (CREA0004): the same credit on every screen. */
export function FullkodCredit({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://fullkod.com/?ref=turno-flash"
      target="_blank"
      rel="noopener"
      className={`inline-flex items-center gap-1.5 text-meta text-foreground-subtle hover:text-foreground ${className}`}
    >
      Desarrollado por
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/fullkod-symbol.svg" alt="" className="h-3.5 w-3.5 dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/fullkod-symbol-reversed.svg" alt="" className="hidden h-3.5 w-3.5 dark:block" />
      <span className="font-semibold text-foreground-muted">Fullkod</span>
    </a>
  );
}

/**
 * Wraps a whole page with the credit at the bottom. `pinned` keeps it inside
 * the viewport of full-screen pages (login, password) without adding height;
 * otherwise it goes after the content, as a footer (legal, help).
 */
export function WithFullkodCredit({
  children,
  pinned = false,
}: {
  children: ReactNode;
  pinned?: boolean;
}) {
  if (!pinned) {
    return (
      <>
        {children}
        <div className="flex justify-center bg-background px-6 pb-8 print:hidden">
          <FullkodCredit />
        </div>
      </>
    );
  }
  return (
    <div className="relative">
      {children}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-6 print:hidden">
        <FullkodCredit className="pointer-events-auto" />
      </div>
    </div>
  );
}
