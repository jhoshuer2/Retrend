const Anthropic = require("@anthropic-ai/sdk");

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

const ANALYSIS_TOOL = {
  name: "submit_analysis",
  description:
    "Submit your analysis of the creator's situation from your role's point of view. Always call this tool with your answer — never answer in plain text.",
  strict: true,
  input_schema: {
    type: "object",
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
          properties: {
            text: { type: "string" },
            why: { type: "string" },
          },
          required: ["text"],
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

async function runRoleAnalysis({ apiKey, rolePromptFrame, channel, question, pastedData }) {
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

  const userPrompt = `${rolePromptFrame}

CHANNEL CONTEXT:
${chLines || "(no channel profile saved yet — answer in general terms for a YouTube creator and say a saved profile would sharpen this)"}

CREATOR'S QUESTION:
${question}

${
  pastedData
    ? `PASTED MATERIAL (stats / comments / script / titles, etc. — use only this, don't invent beyond it):\n${pastedData}`
    : "(nothing pasted in for this run)"
}

Never invent stats, comments, or video titles that weren't given to you. If something important is missing to answer well, say so inside "diagnosis" or "followup" rather than making it up.

Call the submit_analysis tool with your answer. Do not respond in plain text.`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    tools: [ANALYSIS_TOOL],
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: userPrompt }],
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
