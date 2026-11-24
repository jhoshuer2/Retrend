import { NextResponse } from "next/server";
import { sql, ensureTables } from "../../../../lib/db";

export async function GET(req, { params }) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureTables();
  const { id } = await params;

  const convRows = await sql`SELECT * FROM conversations WHERE id = ${id} AND user_id = ${userId};`;
  const conversation = convRows[0];
  if (!conversation) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const messages = await sql`
    SELECT id, sender, content, shared_video, created_at FROM messages
    WHERE conversation_id = ${id} ORDER BY created_at ASC;
  `;
  return NextResponse.json({ conversation, messages });
}

export async function DELETE(req, { params }) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureTables();
  const { id } = await params;
  await sql`DELETE FROM conversations WHERE id = ${id} AND user_id = ${userId};`;
  return NextResponse.json({ ok: true });
}
