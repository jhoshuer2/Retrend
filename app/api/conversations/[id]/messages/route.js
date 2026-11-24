import { NextResponse } from "next/server";
import { sql, ensureTables } from "../../../../../lib/db";
import { getRole } from "../../../../../lib/roles";
import { runChatTurn, buildHistoryForCharacter } from "../../../../../lib/chat";
import { getValidAccessToken } from "../../../../../lib/google-auth";
import { getVideoById, extractVideoId } from "../../../../../lib/youtube";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export async function POST(req, { params }) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureTables();
  const { id: conversationId } = await params;

  const body = await req.json();
  const content = (body?.content || "").trim();
  if (!content) return NextResponse.json({ error: "Message is empty." }, { status: 400 });

  const convRows = await sql`SELECT * FROM conversations WHERE id = ${conversationId} AND user_id = ${userId};`;
  const conversation = convRows[0];
  if (!conversation) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set on this deployment." }, { status: 500 });

  const characterIds = conversation.character_ids || [];
  const characters = characterIds.map((id) => getRole(id)).filter(Boolean);
  const nameMap = Object.fromEntries(characters.map((c) => [c.id, c.name]));

  const profileRows = await sql`SELECT * FROM channel_profile WHERE user_id = ${userId};`;
  const channel = profileRows[0] || { name: "", niche: "", stage: "new", goals: "", notes: "" };

  const priorMessages = await sql`
    SELECT sender, content FROM messages WHERE conversation_id = ${conversationId} ORDER BY created_at ASC;
  `;

  // If the creator shared a YouTube link, pull that video's details in.
  let sharedVideo = null;
  const videoId = extractVideoId(content);
  if (videoId) {
    try {
      const accessToken = await getValidAccessToken(userId);
      sharedVideo = await getVideoById(accessToken, videoId);
    } catch (e) {
      sharedVideo = null; // fail soft — characters will just say they can't see it
    }
  }

  const userMsgId = uid();
  await sql`
    INSERT INTO messages (id, conversation_id, user_id, sender, content, shared_video)
    VALUES (${userMsgId}, ${conversationId}, ${userId}, 'user', ${content}, ${sharedVideo ? JSON.stringify(sharedVideo) : null});
  `;

  const turnResults = await Promise.allSettled(
    characters.map((character) =>
      runChatTurn({
        apiKey,
        character,
        channel,
        liveSnapshot: conversation.live_snapshot,
        sharedVideo,
        history: buildHistoryForCharacter(priorMessages, character.id, nameMap),
        userMessage: content,
        isKickoff: false,
      })
    )
  );

  const assistantMessages = [];
  const actionsAdded = [];
  for (let i = 0; i < characters.length; i++) {
    const character = characters[i];
    const r = turnResults[i];
    const text = r.status === "fulfilled" ? r.value.text : `(${character.name} hit an error replying — try again.)`;
    const actions = r.status === "fulfilled" ? r.value.actions : [];

    const msgId = uid();
    try {
      await sql`
        INSERT INTO messages (id, conversation_id, user_id, sender, content)
        VALUES (${msgId}, ${conversationId}, ${userId}, ${character.id}, ${text});
      `;
      assistantMessages.push({ id: msgId, sender: character.id, content: text, created_at: new Date().toISOString() });
    } catch (e) {
      console.error("message insert failed", character.id, e);
      assistantMessages.push({ id: msgId, sender: character.id, content: text, created_at: new Date().toISOString() });
      continue; // don't try to log actions off a message that failed to save
    }

    for (const action of actions || []) {
      // Defensive: even with a strict tool schema, never let a malformed
      // tool call take down the whole message send.
      if (!action?.text || typeof action.text !== "string" || !action.text.trim()) continue;
      try {
        const taskId = uid();
        await sql`
          INSERT INTO tasks (id, user_id, text, why, role, run_id)
          VALUES (${taskId}, ${userId}, ${action.text}, ${action.why || ""}, ${character.id}, ${conversationId});
        `;
        actionsAdded.push({ id: taskId, text: action.text, why: action.why || "", role: character.id });
      } catch (e) {
        console.error("task insert failed", character.id, e);
      }
    }
  }

  // Title the conversation from the creator's first real message.
  const isFirstUserMessage = !priorMessages.some((m) => m.sender === "user");
  if (isFirstUserMessage) {
    await sql`UPDATE conversations SET title = ${content.slice(0, 60)}, updated_at = now() WHERE id = ${conversationId};`;
  } else {
    await sql`UPDATE conversations SET updated_at = now() WHERE id = ${conversationId};`;
  }

  return NextResponse.json({
    userMessage: { id: userMsgId, sender: "user", content, shared_video: sharedVideo },
    assistantMessages,
    actionsAdded,
  });
}
