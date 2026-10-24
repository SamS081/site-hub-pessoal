import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Nunito, Quicksand } from "next/font/google";
import { redirect } from "next/navigation";

import { NotesClient } from "@/components/notas/notes-client";
import { getCurrentUser } from "@/lib/auth";
import "./notas.css";

/* The page's own voices, both rounded and soft: Quicksand for titles, Nunito for reading. */
const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin", "latin-ext"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Notas · Atol",
};

export const viewport: Viewport = {
  themeColor: "#e9c9a8",
  colorScheme: "light",
};

export default function NotasPage() {
  return (
    <div className={`luz ${quicksand.variable} ${nunito.variable} min-h-dvh`}>
      <Suspense fallback={<div className="min-h-dvh" />}>
        <SignedInNotes />
      </Suspense>
    </div>
  );
}

/* Reads the session cookie, so it streams in behind the boundary. */
async function SignedInNotes() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <NotesClient user={{ id: user.id, name: user.name }} />;
}
