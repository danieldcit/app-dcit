"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

// pointerdown (not click) so the close fires before whatever the outside
// target's own click handler would do — matters for e.g. a nav link right
// next to the bell, which should navigate on its own click, not first
// re-render with the panel still open from a stale click event.
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [ref, onOutside, enabled]);
}
