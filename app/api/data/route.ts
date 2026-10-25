import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { isOrbitaData, MAX_BYTES, readUserData, writeUserData } from "@/lib/store";

/*
 * The signed-in account's tasks, notes and habits (lib/store.ts).
 *
 *   GET  → { data, rev }, or { data: null, rev: 0 } before the first save
 *   PUT  { data, baseRev } → { rev }, or 409 { data, rev } when the stored
 *        document has moved on since baseRev
 */

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  const stored = await readUserData(user.id);
  return NextResponse.json(stored ?? { data: null, rev: 0 }, { headers: noStore });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const text = await request.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ error: "too large" }, { status: 413, headers: noStore });

  let body: { data?: unknown; baseRev?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400, headers: noStore });
  }
  const baseRev = body.baseRev;
  if (!isOrbitaData(body.data) || typeof baseRev !== "number" || !Number.isInteger(baseRev) || baseRev < 0) {
    return NextResponse.json({ error: "invalid data" }, { status: 400, headers: noStore });
  }

  const rev = await writeUserData(user.id, JSON.stringify(body.data), baseRev);
  if (rev !== null) return NextResponse.json({ rev }, { headers: noStore });

  const current = await readUserData(user.id);
  return NextResponse.json(current ?? { data: null, rev: 0 }, { status: 409, headers: noStore });
}
