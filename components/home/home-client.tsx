"use client";

import dynamic from "next/dynamic";

/**
 * The home reads localStorage and the local clock on first render, so it is
 * rendered on the client only; the server sends just the night-sky ground.
 */
export const HomeClient = dynamic(() => import("@/components/home/home"), {
  ssr: false,
  loading: () => <div className="min-h-dvh bg-background" />,
});
