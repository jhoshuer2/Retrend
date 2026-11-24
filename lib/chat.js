const Anthropic = require("@anthropic-ai/sdk");

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

// The model can call this any time it hands the creator a concrete, doable
// step — it keeps replying in normal text, this just additionally files the
// step onto their tracked task list.
const LOG_ACTION_TOOL = {
  name: "log_action",
  description:
    "Call this any time you give the creator a concrete, specific, doable action to take on their channel — so it's saved to their tracked task list. You can call it zero, one, or several times in a single reply (once per distinct action). This does not replace your normal text reply; keep talking normally, this just files the action in parallel. Don't call it for vague encouragement — only for clear, specific steps.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      text: { type: "string", description: "The action itself, written as a short instruction to the creator." },
      why: { type: "string", description: "One short sentence on why this matters. Empty string if it's self-evident." },
    },
    required: ["text", "why"],
  },
};

function channelContextBlock(channel) {
  const lines = [
    channel?.name ? `Channel name: ${channel.name}` : null,
    channel?.niche ? `Niche: ${channel.niche}` : null,
    channel?.stage
      ? `Stage: ${
          channel.stage === "new"
            ? "just starting, little/no data yet"
            : channel.stage === "growing"
            ? "growing, some data available"
            : "established, steady numbers available"
        }`
      : null,
    channel?.goals ? `Goals: ${channel.goals}` : null,
    channel?.notes ? `Other context: ${channel.notes}` : null,
  ].filter(Boolean);
  return lines.length ? lines.join("\n") : "(no channel profile saved yet)";
}

function liveSnapshotBlock(liveSnapshot) {
  if (!liveSnapshot) return null;
  const { channel, videos, analytics } = liveSnapshot;
  const parts = [];
  if (channel) {
    parts.push(
      `LIVE CHANNEL DATA (pulled from YouTube when this conversation started):\n` +
        `Title: ${channel.title}\nSubscribers: ${channel.subscriberCount}\nTotal views: ${channel.viewCount}\nTotal videos: ${channel.videoCount}\n` +
        `Channel description: ${(channel.description || "").slice(0, 300)}`
    );
  }
  if (analytics && !analytics.error) {
    parts.push(
      `LIVE ANALYTICS (last ${analytics.periodDays} days — impressions/thumbnail-CTR are not available via the API, so they're never included):\n` +
        Object.entries(analytics)
          .filter(([k]) => k !== "periodDays")
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")
    );
  }
  if (videos?.length) {
    parts.push(
      `LIVE RECENT VIDEOS (most recent ${videos.length}):\n` +
        videos
          .map(
            (v, i) =>
              `${i + 1}. "${v.title}" — published ${v.publishedAt}, ${v.viewCount || 0} views, ${v.likeCount || 0} likes, ${v.commentCount || 0} comments. Video ID: ${v.id}`
          )
          .join("\n")
    );
  }
  return parts.length ? parts.join("\n\n") : null;
}

function sharedVideoBlock(video) {
  if (!video) return null;
  const parts = [
    `A VIDEO WAS JUST SHARED IN THIS CONVERSATION — look closely at this one specifically:`,
    `Title: "${video.title}"`,
    `Published: ${video.publishedAt}`,
    `Views: ${video.viewCount || 0}, Likes: ${video.likeCount || 0}, Comments: ${video.commentCount || 0}`,
    video.description ? `Description: ${video.description.slice(0, 500)}` : null,
    video.transcript
      ? `Transcript (may be partial): ${video.transcript.slice(0, 3000)}`
      : "(no transcript/captions available for this video)",
    video.topComments?.length
      ? `Top comments: ${video.topComments.slice(0, 8).map((c) => `"${c.text}"`).join(" | ")}`
      : "(no comments available)",
  ].filter(Boolean);
  return parts.join("\n");
}

// Turns the conversation's flat message list into this character's view of
// history: their own past replies are "assistant" turns, everything else
// (the creator, and any other joined character) is a "user" turn. Adjacent
// same-role turns get merged since the API expects strict alternation.
function buildHistoryForCharacter(messages, characterId, characterNames) {
  const turns = messages.map((m) => {
    if (m.sender === characterId) {
      return { role: "assistant", text: m.content };
    }
    if (m.sender === "user") {
      return { role: "user", text: m.content };
    }
    const name = characterNames[m.sender] || m.sender;
    return { role: "user", text: `[${name} said]: ${m.content}` };
  });

  const merged = [];
  for (const t of turns) {
    const last = merged[merged.length - 1];
    if (last && last.role === t.role) {
      last.text += "\n\n" + t.text;
    } else {
      merged.push({ ...t });
    }
  }
  return merged.map((t) => ({ role: t.role, content: t.text }));
}

async function runChatTurn({
  apiKey,
  character,
  channel,
  liveSnapshot,
  sharedVideo,
  history, // already-built [{role, content}]
  userMessage, // string, or null for a kickoff message with no new input
  isKickoff,
}) {
  const client = new Anthropic({ apiKey });

  const systemPrompt = `${character.frame(channel || {})}

You're in an ongoing, casual back-and-forth chat with the creator, alongside possibly other role-characters who may also be in this thread — like a group DM, not a one-shot report. Reply conversationally in normal paragraphs (short bullet lists are fine when listing several things), not a rigid template. Stay in character as this one role — don't try to cover every other role's territory. Ask a clarifying question when you genuinely need one instead of guessing. Keep replies tight — usually under ~160 words unless the creator is clearly asking for depth.

Never invent stats, comments, video titles, or transcript content that wasn't actually given to you below. If something's missing, say so plainly and ask for it or suggest how they could get it.

CHANNEL CONTEXT:
${channelContextBlock(channel)}

${liveSnapshotBlock(liveSnapshot) || "(no live YouTube data loaded for this conversation — if you need it, tell the creator they can turn it on.)"}

${sharedVideo ? sharedVideoBlock(sharedVideo) : ""}

When you recommend something concrete and doable, call the log_action tool for it in addition to replying in text, so it lands on the creator's tracked task list. Only call it for clear, specific actions — not general encouragement.`;

  const messages = [...history];
  if (isKickoff) {
    messages.push({
      role: "user",
      content:
        "(The creator just started this conversation and added you to it — there's no message from them yet. Introduce yourself in ONE short sentence as this role, then tell them in one more sentence what's useful to share next: a specific question, a YouTube video link, or just a description of what's going on. Keep it brief and warm — this is a greeting, not an analysis.)",
    });
  } else {
    messages.push({ role: "user", content: userMessage });
  }

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    tools: [LOG_ACTION_TOOL],
    tool_choice: { type: "auto" },
    messages,
  });

  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n\n")
    .trim();
  const actions = msg.content.filter((b) => b.type === "tool_use" && b.name === "log_action").map((b) => b.input);

  return { text: text || "...", actions };
}

module.exports = { runChatTurn, buildHistoryForCharacter, MODEL };
