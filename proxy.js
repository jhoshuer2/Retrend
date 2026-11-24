import { NextResponse } from "next/server";
import { getUserIdForSession } from "./lib/google-auth";

export const config = {
  matcher: ["/((?!_next|favicon.ico|login|api/auth).*)"],
};

export async function proxy(req) {
  const token = req.cookies.get("mh_session")?.value;
  const userId = await getUserIdForSession(token).catch(() => null);

  if (userId) {
    const headers = new Headers(req.headers);
    headers.set("x-user-id", userId);
    return NextResponse.next({ request: { headers } });
  }

  if (req.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}
