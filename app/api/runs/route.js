import { NextResponse } from "next/server";
import { sql, ensureTables } from "../../../lib/db";

export async function GET(req) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureTables();
  const rows = await sql`SELECT * FROM runs WHERE user_id = ${userId} ORDER BY "timestamp" DESC LIMIT 100;`;
  return NextResponse.json({ runs: rows });
}

export async function POST(req) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureTables();
  const body = await req.json();
  const {
    id,
    question = "",
    pastedData = "",
    channelSnapshot = {},
    roles = [],
    roleResults = {},
    usedLiveData = false,
  } = body || {};
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  await sql`
    INSERT INTO runs (id, user_id, "timestamp", question, pasted_data, channel_snapshot, roles, role_results, used_live_data)
    VALUES (
      ${id}, ${userId}, now(), ${question}, ${pastedData},
      ${JSON.stringify(channelSnapshot)}, ${JSON.stringify(roles)}, ${JSON.stringify(roleResults)}, ${usedLiveData}
    )
    ON CONFLICT (id) DO NOTHING;
  `;
  return NextResponse.json({ ok: true });
}
