import { NextResponse } from "next/server";
import { sql, ensureTables } from "../../../lib/db";

export async function GET(req) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureTables();
  const rows = await sql`SELECT * FROM tasks WHERE user_id = ${userId} ORDER BY created_at DESC;`;
  return NextResponse.json({ tasks: rows });
}

export async function POST(req) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureTables();
  const body = await req.json();
  const { id, text, why = "", role = "", runId = "" } = body || {};
  if (!id || !text) {
    return NextResponse.json({ error: "id and text are required." }, { status: 400 });
  }
  await sql`
    INSERT INTO tasks (id, user_id, text, why, role, run_id, done, created_at)
    VALUES (${id}, ${userId}, ${text}, ${why}, ${role}, ${runId}, false, now())
    ON CONFLICT (id) DO NOTHING;
  `;
  return NextResponse.json({ ok: true });
}

export async function PATCH(req) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureTables();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  const body = await req.json();
  await sql`UPDATE tasks SET done = ${!!body.done} WHERE id = ${id} AND user_id = ${userId};`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureTables();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  await sql`DELETE FROM tasks WHERE id = ${id} AND user_id = ${userId};`;
  return NextResponse.json({ ok: true });
}
