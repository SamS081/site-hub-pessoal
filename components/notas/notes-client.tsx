"use client";

import dynamic from "next/dynamic";

/**
 * The notes page reads localStorage on first render, so it is rendered on
 * the client only.
 */
export const NotesClient = dynamic(() => import("@/components/notas/notes-page"), {
  ssr: false,
  loading: () => <div className="min-h-dvh" />,
});
