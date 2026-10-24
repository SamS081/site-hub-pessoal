import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { redirect } from "next/navigation";

import { TasksClient } from "@/components/tarefas/tasks-client";
import { getCurrentUser } from "@/lib/auth";
import "./tarefas.css";

/* The page's own display voice: Archivo, heavy and slightly expanded. */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Tarefas · Atol",
};

export const viewport: Viewport = {
  themeColor: "#07130b",
};

export default function TarefasPage() {
  return (
    <div className={`mata ${archivo.variable} min-h-dvh`}>
      <Suspense fallback={<div className="min-h-dvh" />}>
        <SignedInTasks />
      </Suspense>
    </div>
  );
}

/* Reads the session cookie, so it streams in behind the boundary. */
async function SignedInTasks() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <TasksClient user={{ id: user.id, name: user.name }} />;
}
