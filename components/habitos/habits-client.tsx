"use client";

import dynamic from "next/dynamic";

/**
 * The habits page reads localStorage and the local clock on first render, so
 * it is rendered on the client only.
 */
export const HabitsClient = dynamic(() => import("@/components/habitos/habits-page"), {
  ssr: false,
  loading: () => <div className="min-h-dvh" />,
});
