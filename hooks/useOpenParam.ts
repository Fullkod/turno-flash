import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Opens one item of the page when the URL carries `?open=<id>` (a row of
 * Finanzas), then drops the flag so Back and refresh don't reopen it. Same idea
 * as useCreateParam; needs a Suspense boundary above (useSearchParams).
 */
export function useOpenParam(onOpen: (id: string) => void, ready: boolean) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = searchParams.get("open");

  useEffect(() => {
    if (!id || !ready) return;
    const rest = new URLSearchParams(searchParams.toString());
    rest.delete("open");
    router.replace(rest.size ? `${pathname}?${rest}` : pathname);
    onOpen(id);
  }, [id, ready, onOpen, router, pathname, searchParams]);
}
