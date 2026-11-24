import { NextResponse } from "next/server";
import { sql, ensureTables } from "../../../lib/db";

export async function GET() {
  await ensureTables();
  const rows = await sql`SELECT * FROM runs ORDER BY "timestamp" DESC LIMIT 100;`;
  return NextResponse.json({ runs: rows });
}

export async function POST(req) {
  await ensureTables();
  const body = await req.json();
  const {
    id,
    question = "",
    pastedData = "",
    channelSnapshot = {},
    roles = [],
    roleResults = {},
  } = body || {};
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  await sql`
    INSERT INTO runs (id, "timestamp", question, pasted_data, channel_snapshot, roles, role_results)
    VALUES (
      ${id}, now(), ${question}, ${pastedData},
      ${JSON.stringify(channelSnapshot)}, ${JSON.stringify(roles)}, ${JSON.stringify(roleResults)}
    )
    ON CONFLICT (id) DO NOTHING;
  `;
  return NextResponse.json({ ok: true });
}
