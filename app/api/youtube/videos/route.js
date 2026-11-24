import { NextResponse } from "next/server";
import { getValidAccessToken } from "../../../../lib/google-auth";
import { getMyChannel, getRecentVideos, getTopComments, getTranscript } from "../../../../lib/youtube";

export async function GET(req) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const withComments = searchParams.get("comments") === "true";
  const withTranscript = searchParams.get("transcript") === "true";
  const limit = Math.min(Number(searchParams.get("limit")) || 8, 20);

  try {
    const accessToken = await getValidAccessToken(userId);
    const channel = await getMyChannel(accessToken);
    if (!channel?.uploadsPlaylistId) {
      return NextResponse.json({ videos: [] });
    }
    const videos = await getRecentVideos(accessToken, channel.uploadsPlaylistId, limit);

    if (withComments || withTranscript) {
      await Promise.all(
        videos.map(async (v) => {
          if (withComments) v.topComments = await getTopComments(accessToken, v.id, 10);
          if (withTranscript) v.transcript = await getTranscript(accessToken, v.id);
        })
      );
    }

    return NextResponse.json({ videos });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
