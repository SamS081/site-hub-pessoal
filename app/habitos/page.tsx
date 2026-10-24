import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import { redirect } from "next/navigation";

import { HabitsClient } from "@/components/habitos/habits-client";
import { getCurrentUser } from "@/lib/auth";
import "./habitos.css";

/* The page's own voice: Hanken Grotesk, set light and large. */
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Hábitos · Atol",
};

export const viewport: Viewport = {
  themeColor: "#11152b",
  colorScheme: "dark",
};

export default function HabitosPage() {
  return (
    <div className={`lav ${hanken.variable} min-h-dvh`}>
      <Suspense fallback={<div className="min-h-dvh" />}>
        <SignedInHabits />
      </Suspense>
    </div>
  );
}

/* Reads the session cookie, so it streams in behind the boundary. */
async function SignedInHabits() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <HabitsClient user={{ id: user.id, name: user.name }} />;
}
