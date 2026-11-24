import { NextResponse } from "next/server";
import { buildAuthUrl } from "../../../../../lib/google-auth";

export async function GET() {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID is not set on this deployment yet." },
      { status: 500 }
    );
  }
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(buildAuthUrl(state));
  res.cookies.set("mh_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
