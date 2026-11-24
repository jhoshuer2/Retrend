import { NextResponse } from "next/server";
import { sql, ensureTables } from "../../../../../lib/db";
import { tryFetchLiveSnapshot } from "../../../../../lib/live-data";

export async function POST(req, { params }) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureTables();
  const { id: conversationId } = await params;

  const convRows = await sql`SELECT id FROM conversations WHERE id = ${conversationId} AND user_id = ${userId};`;
  if (!convRows[0]) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const liveSnapshot = await tryFetchLiveSnapshot(userId);
  if (!liveSnapshot) {
    return NextResponse.json({ error: "Couldn't load your YouTube data — try signing in again." }, { status: 502 });
  }
  await sql`UPDATE conversations SET live_snapshot = ${JSON.stringify(liveSnapshot)}, updated_at = now() WHERE id = ${conversationId};`;
  return NextResponse.json({ liveSnapshot });
}
