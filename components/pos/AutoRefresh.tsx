"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Vuelve a pedir los datos cada cierto tiempo para que varias tablets
 * vean el mismo estado de mesas sin recargar a mano.
 */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [router, seconds]);
  return null;
}
