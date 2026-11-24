import { NextResponse } from "next/server";
import { sql, ensureTables } from "../../../lib/db";
import { getRole } from "../../../lib/roles";
import { runChatTurn } from "../../../lib/chat";
import { tryFetchLiveSnapshot } from "../../../lib/live-data";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export async function GET(req) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureTables();
  const rows = await sql`
    SELECT id, title, character_ids, created_at, updated_at
    FROM conversations WHERE user_id = ${userId}
    ORDER BY updated_at DESC;
  `;
  return NextResponse.json({ conversations: rows });
}

export async function POST(req) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureTables();

  const body = await req.json();
  const characterIds = Array.isArray(body?.characterIds) ? body.characterIds.filter((id) => getRole(id)) : [];
  const useLiveData = !!body?.useLiveData;
  if (characterIds.length === 0) {
    return NextResponse.json({ error: "Pick at least one role to start with." }, { status: 400 });
  }

  const [profileRows, apiKey] = [
    await sql`SELECT * FROM channel_profile WHERE user_id = ${userId};`,
    process.env.ANTHROPIC_API_KEY,
  ];
  const channel = profileRows[0] || { name: "", niche: "", stage: "new", goals: "", notes: "" };
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set on this deployment." }, { status: 500 });

  let liveSnapshot = null;
  if (useLiveData) {
    liveSnapshot = await tryFetchLiveSnapshot(userId);
  }

  const conversationId = uid();
  await sql`
    INSERT INTO conversations (id, user_id, title, character_ids, live_snapshot)
    VALUES (${conversationId}, ${userId}, 'New conversation', ${JSON.stringify(characterIds)}, ${liveSnapshot ? JSON.stringify(liveSnapshot) : null});
  `;

  // Kick things off: each joined character introduces itself and says what to share next.
  const kickoffResults = await Promise.allSettled(
    characterIds.map((id) =>
      runChatTurn({
        apiKey,
        character: getRole(id),
        channel,
        liveSnapshot,
        sharedVideo: null,
        history: [],
        userMessage: null,
        isKickoff: true,
      })
    )
  );

  const messages = [];
  for (let i = 0; i < characterIds.length; i++) {
    const r = kickoffResults[i];
    const text = r.status === "fulfilled" ? r.value.text : `Hey, I'm your ${getRole(characterIds[i]).name}. What's going on with your channel?`;
    const msgId = uid();
    await sql`
      INSERT INTO messages (id, conversation_id, user_id, sender, content)
      VALUES (${msgId}, ${conversationId}, ${userId}, ${characterIds[i]}, ${text});
    `;
    messages.push({ id: msgId, sender: characterIds[i], content: text, created_at: new Date().toISOString() });
  }

  return NextResponse.json({
    conversation: { id: conversationId, title: "New conversation", character_ids: characterIds, live_snapshot: liveSnapshot },
    messages,
  });
}
