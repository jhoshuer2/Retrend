import { NextResponse } from "next/server";
import { getValidAccessToken } from "../../../../lib/google-auth";
import { getMyChannel, getAnalyticsSummary } from "../../../../lib/youtube";

export async function GET(req) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const accessToken = await getValidAccessToken(userId);
    const channel = await getMyChannel(accessToken);
    if (!channel) {
      return NextResponse.json({ error: "No YouTube channel found on this Google account." }, { status: 404 });
    }
    const analytics = await getAnalyticsSummary(accessToken, channel.id, 28);
    return NextResponse.json({ channel, analytics });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
