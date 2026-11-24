import { NextResponse } from "next/server";
import { sql, ensureTables } from "../../../../../../lib/db";

export async function DELETE(req, { params }) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureTables();
  const { id: conversationId, messageId } = await params;

  // Scope through the conversation too, so you can't delete into someone else's thread.
  const convRows = await sql`SELECT id FROM conversations WHERE id = ${conversationId} AND user_id = ${userId};`;
  if (!convRows[0]) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await sql`DELETE FROM messages WHERE id = ${messageId} AND conversation_id = ${conversationId} AND user_id = ${userId};`;
  return NextResponse.json({ ok: true });
}
