import { NextResponse } from "next/server";
import { sql, ensureTables } from "../../../lib/db";

export async function GET(req) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureTables();
  const rows = await sql`SELECT id, email, name, picture FROM users WHERE id = ${userId};`;
  return NextResponse.json({ user: rows[0] || null });
}
