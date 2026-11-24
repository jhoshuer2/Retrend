import { NextResponse } from "next/server";
import { sql, ensureTables } from "../../../lib/db";

export async function GET() {
  await ensureTables();
  const rows = await sql`SELECT * FROM channel_profile WHERE id = 1;`;
  const row = rows[0] || { name: "", niche: "", stage: "new", goals: "", notes: "" };
  return NextResponse.json({ channel: row });
}

export async function POST(req) {
  await ensureTables();
  const body = await req.json();
  const { name = "", niche = "", stage = "new", goals = "", notes = "" } = body || {};

  await sql`
    INSERT INTO channel_profile (id, name, niche, stage, goals, notes, updated_at)
    VALUES (1, ${name}, ${niche}, ${stage}, ${goals}, ${notes}, now())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      niche = EXCLUDED.niche,
      stage = EXCLUDED.stage,
      goals = EXCLUDED.goals,
      notes = EXCLUDED.notes,
      updated_at = now();
  `;
  return NextResponse.json({ ok: true });
}
