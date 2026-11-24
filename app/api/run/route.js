import { NextResponse } from "next/server";
import { getRole } from "../../../lib/roles";
import { runRoleAnalysis } from "../../../lib/anthropic";

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on this deployment." },
      { status: 500 }
    );
  }

  const body = await req.json();
  const { roleId, question, pastedData, channel, liveData } = body || {};

  const role = getRole(roleId);
  if (!role) {
    return NextResponse.json({ error: "Unknown role." }, { status: 400 });
  }
  if (!question || !question.trim()) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }

  try {
    const result = await runRoleAnalysis({
      apiKey,
      rolePromptFrame: role.frame(channel || {}),
      channel: channel || {},
      question,
      pastedData: pastedData || "",
      liveData: liveData || null,
    });
    return NextResponse.json({ result });
  } catch (err) {
    console.error("run error", err);
    return NextResponse.json(
      { error: err.message || "Something went wrong asking Claude." },
      { status: 502 }
    );
  }
}
