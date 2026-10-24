"use client";

import { useEffect } from "react";

/*
 * Liquid glass sheen. One delegated pointer listener for the whole page
 * writes the pointer position, as percentages, into --mx / --my on the
 * nearest [data-glass-pointer] element, at most once per frame. The CSS in
 * app/styles/glass.css draws the specular highlight there. Shared by every
 * component that calls the hook; installed on first use, removed on last.
 */
let users = 0;
let detach: (() => void) | null = null;

function attach() {
  let frame = 0;
  let pending: PointerEvent | null = null;

  const flush = () => {
    frame = 0;
    const event = pending;
    pending = null;
    if (!event || !(event.target instanceof Element)) return;
    const el = event.target.closest<HTMLElement>("[data-glass-pointer]");
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--mx", `${x.toFixed(1)}%`);
    el.style.setProperty("--my", `${y.toFixed(1)}%`);
  };

  const onPointer = (event: PointerEvent) => {
    pending = event;
    if (!frame) frame = requestAnimationFrame(flush);
  };

  document.addEventListener("pointermove", onPointer, { passive: true });
  document.addEventListener("pointerdown", onPointer, { passive: true });
  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener("pointermove", onPointer);
    document.removeEventListener("pointerdown", onPointer);
  };
}

export function useGlassPointer() {
  useEffect(() => {
    users += 1;
    if (users === 1) detach = attach();
    return () => {
      users -= 1;
      if (users === 0) {
        detach?.();
        detach = null;
      }
    };
  }, []);
}
