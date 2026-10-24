"use client";

import dynamic from "next/dynamic";

/**
 * The tasks page reads localStorage and the local clock on first render, so
 * it is rendered on the client only.
 */
export const TasksClient = dynamic(() => import("@/components/tarefas/tasks-page"), {
  ssr: false,
  loading: () => <div className="min-h-dvh" />,
});
