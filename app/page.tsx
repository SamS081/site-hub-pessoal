import { Suspense } from "react";
import { redirect } from "next/navigation";

import { HomeClient } from "@/components/orbita/home-client";
import { getCurrentUser } from "@/lib/auth";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <SignedInHome />
    </Suspense>
  );
}

/* Reads the session cookie, so it streams in behind the boundary. */
async function SignedInHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <HomeClient user={{ id: user.id, name: user.name }} />;
}
