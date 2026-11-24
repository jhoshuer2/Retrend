import { NextResponse } from "next/server";
import { deleteSession } from "../../../../lib/google-auth";

export async function POST(req) {
  const token = req.cookies.get("mh_session")?.value;
  if (token) await deleteSession(token).catch(() => {});
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("mh_session");
  return res;
}
