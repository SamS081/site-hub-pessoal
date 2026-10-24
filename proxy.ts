import { NextResponse, type NextRequest } from "next/server";

/*
 * An early, optimistic check: without a session cookie the home, the tasks, the notes and the habits pages go straight
 * to the login. The real check (is the session valid?) runs in each page.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("atol_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/", "/tarefas", "/notas", "/habitos"],
};
