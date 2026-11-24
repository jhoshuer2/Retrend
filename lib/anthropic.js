const Anthropic = require("@anthropic-ai/sdk");

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

const ANALYSIS_TOOL = {
  name: "submit_analysis",
  description:
    "Submit your analysis of the creator's situation from your role's point of view. Always call this tool with your answer — never answer in plain text.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      diagnosis: {
        type: "string",
        description:
          "2-4 sentences, plain language, speaking directly to the creator, giving your read on the situation from your role's point of view.",
      },
      findings: {
        type: "array",
        items: { type: "string" },
        description: "2-5 short, specific findings.",
      },
      actions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: { type: "string" },
            why: { type: "string", description: "One short sentence, or an empty string." },
          },
          required: ["text", "why"],
        },
        description: "3-6 concrete, doable actions, each with a one-sentence 'why'.",
      },
      followup: {
        type: "string",
        description:
          "One short clarifying question you'd ask next time to sharpen your advice further. Empty string if none.",
      },
    },
    required: ["diagnosis", "findings", "actions", "followup"],
  },
};

function formatLiveData(liveData) {
  if (!liveData) return null;
  const { channel, videos, analytics } = liveData;
  const parts = [];

  if (channel) {
    parts.push(
      `LIVE CHANNEL DATA (pulled just now from YouTube):\n` +
        `Title: ${channel.title}\nSubscribers: ${channel.subscriberCount}\nTotal views: ${channel.viewCount}\nTotal videos: ${channel.videoCount}\n` +
        `Channel description: ${(channel.description || "").slice(0, 300)}`
    );
  }
  if (analytics && !analytics.error) {
    parts.push(
      `LIVE ANALYTICS (last ${analytics.periodDays} days — note: impressions/thumbnail-CTR are not available via the API, so they're not included here):\n` +
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
              `${i + 1}. "${v.title}" — published ${v.publishedAt}, ${v.viewCount || 0} views, ${v.likeCount || 0} likes, ${v.commentCount || 0} comments.` +
              (v.transcript ? ` Transcript excerpt: ${v.transcript.slice(0, 600)}` : "") +
              (v.topComments?.length
                ? ` Top comments: ${v.topComments.slice(0, 5).map((c) => `"${c.text}"`).join(" | ")}`
                : "")
          )
          .join("\n")
    );
  }
  return parts.length ? parts.join("\n\n") : null;
}

async function runRoleAnalysis({ apiKey, rolePromptFrame, channel, question, pastedData, liveData }) {
  const client = new Anthropic({ apiKey });

  const chLines = [
    channel.name ? `Channel name: ${channel.name}` : null,
    channel.niche ? `Niche: ${channel.niche}` : null,
    `Stage: ${
      channel.stage === "new"
        ? "just starting, little/no data yet"
        : channel.stage === "growing"
        ? "growing, some data available"
        : "established, steady numbers available"
    }`,
    channel.goals ? `Goals: ${channel.goals}` : null,
    channel.notes ? `Other context: ${channel.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const liveDataText = formatLiveData(liveData);

  const userPrompt = `${rolePromptFrame}

CHANNEL CONTEXT:
${chLines || "(no channel profile saved yet — answer in general terms for a YouTube creator and say a saved profile would sharpen this)"}

CREATOR'S QUESTION:
${question}

${liveDataText ? liveDataText + "\n" : ""}
${
  pastedData
    ? `PASTED MATERIAL (stats / comments / script / titles, etc. — use only this, don't invent beyond it):\n${pastedData}`
    : liveDataText
    ? "(nothing manually pasted in — live data above is what's available)"
    : "(nothing pasted in for this run)"
}

Never invent stats, comments, or video titles that weren't given to you or weren't in the live data above. If something important is missing to answer well, say so inside "diagnosis" or "followup" rather than making it up.

Call the submit_analysis tool with your answer. Do not respond in plain text.`;

  const content = [{ type: "text", text: userPrompt }];
  const thumbnails = (liveData?.videos || []).filter((v) => v.thumbnail).slice(0, 6);
  for (const v of thumbnails) {
    content.push({ type: "image", source: { type: "url", url: v.thumbnail } });
    content.push({ type: "text", text: `(thumbnail for "${v.title}")` });
  }

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    tools: [ANALYSIS_TOOL],
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content }],
  });

  const toolUse = msg.content.find((b) => b.type === "tool_use");
  if (!toolUse) {
    // Fallback: the model answered in plain text instead of calling the tool.
    const text = msg.content.find((b) => b.type === "text")?.text || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {
        // fall through
      }
    }
    throw new Error("Model did not return a structured analysis.");
  }
  return toolUse.input;
}

module.exports = { runRoleAnalysis, MODEL };
