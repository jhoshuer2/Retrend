import { NextResponse } from "next/server";
import { sql, ensureTables } from "../../../lib/db";

export async function GET(req) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureTables();
  const rows = await sql`SELECT * FROM channel_profile WHERE user_id = ${userId};`;
  const row = rows[0] || { name: "", niche: "", stage: "new", goals: "", notes: "" };
  return NextResponse.json({ channel: row });
}

export async function POST(req) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureTables();
  const body = await req.json();
  const { name = "", niche = "", stage = "new", goals = "", notes = "" } = body || {};

  await sql`
    INSERT INTO channel_profile (user_id, name, niche, stage, goals, notes, updated_at)
    VALUES (${userId}, ${name}, ${niche}, ${stage}, ${goals}, ${notes}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      name = EXCLUDED.name,
      niche = EXCLUDED.niche,
      stage = EXCLUDED.stage,
      goals = EXCLUDED.goals,
      notes = EXCLUDED.notes,
      updated_at = now();
  `;
  return NextResponse.json({ ok: true });
}
