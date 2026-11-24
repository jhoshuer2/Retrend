import { NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!_next|favicon.ico|login|api/auth).*)"],
};

export function proxy(req) {
  const password = process.env.APP_PASSWORD;
  // If no password is configured, don't lock the owner out — but this
  // means the deployment is open to anyone with the URL.
  if (!password) return NextResponse.next();

  const cookie = req.cookies.get("mh_session")?.value;
  if (cookie === password) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}
