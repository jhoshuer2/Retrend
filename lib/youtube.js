const YT_API = "https://www.googleapis.com/youtube/v3";
const YT_ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2";

async function ytFetch(path, accessToken, params = {}) {
  const url = new URL(`${YT_API}/${path}`);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `YouTube API error on ${path}`);
  return data;
}

// The signed-in user's own channel: id, title, description, stats, uploads playlist id.
async function getMyChannel(accessToken) {
  const data = await ytFetch("channels", accessToken, {
    part: "snippet,statistics,contentDetails",
    mine: "true",
  });
  const ch = data.items?.[0];
  if (!ch) return null;
  return {
    id: ch.id,
    title: ch.snippet?.title,
    description: ch.snippet?.description,
    thumbnail: ch.snippet?.thumbnails?.medium?.url || ch.snippet?.thumbnails?.default?.url,
    subscriberCount: ch.statistics?.subscriberCount,
    viewCount: ch.statistics?.viewCount,
    videoCount: ch.statistics?.videoCount,
    uploadsPlaylistId: ch.contentDetails?.relatedPlaylists?.uploads,
  };
}

// Most recent videos (title, description, thumbnail, stats, publish date).
async function getRecentVideos(accessToken, uploadsPlaylistId, maxResults = 10) {
  const playlistData = await ytFetch("playlistItems", accessToken, {
    part: "contentDetails",
    playlistId: uploadsPlaylistId,
    maxResults,
  });
  const videoIds = (playlistData.items || []).map((i) => i.contentDetails.videoId).filter(Boolean);
  if (videoIds.length === 0) return [];

  const videosData = await ytFetch("videos", accessToken, {
    part: "snippet,statistics,contentDetails",
    id: videoIds.join(","),
  });

  return (videosData.items || []).map((v) => ({
    id: v.id,
    title: v.snippet?.title,
    description: v.snippet?.description,
    publishedAt: v.snippet?.publishedAt,
    thumbnail: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url,
    tags: v.snippet?.tags || [],
    duration: v.contentDetails?.duration,
    viewCount: v.statistics?.viewCount,
    likeCount: v.statistics?.likeCount,
    commentCount: v.statistics?.commentCount,
  }));
}

// Public top-level comments for a video (first page, no OAuth scope needed beyond what we have).
async function getTopComments(accessToken, videoId, maxResults = 15) {
  try {
    const data = await ytFetch("commentThreads", accessToken, {
      part: "snippet",
      videoId,
      maxResults,
      order: "relevance",
      textFormat: "plainText",
    });
    return (data.items || []).map((c) => ({
      author: c.snippet?.topLevelComment?.snippet?.authorDisplayName,
      text: c.snippet?.topLevelComment?.snippet?.textDisplay,
      likeCount: c.snippet?.topLevelComment?.snippet?.likeCount,
    }));
  } catch (e) {
    // Comments can be disabled on a video — not a fatal error.
    return [];
  }
}

// Caption track text for a video, if one exists and is downloadable with this token
// (only works for videos the signed-in user owns).
async function getTranscript(accessToken, videoId) {
  try {
    const list = await ytFetch("captions", accessToken, { part: "snippet", videoId });
    const track =
      list.items?.find((t) => t.snippet?.trackKind !== "ASR") || list.items?.[0];
    if (!track) return null;

    const res = await fetch(
      `${YT_API}/captions/${track.id}?tfmt=srt`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const srt = await res.text();
    // Strip SRT index/timestamp lines, keep just the spoken text.
    return srt
      .split("\n")
      .filter((line) => line.trim() && !/^\d+$/.test(line.trim()) && !line.includes("-->"))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  } catch (e) {
    return null;
  }
}

// Channel-level analytics summary over the last N days.
// Note: impressions / thumbnail click-through-rate are NOT exposed by this API —
// that data only exists in YouTube Studio's UI, OAuth or not.
async function getAnalyticsSummary(accessToken, channelId, days = 28) {
  const end = new Date();
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);

  const url = new URL(`${YT_ANALYTICS_API}/reports`);
  url.searchParams.set("ids", `channel==${channelId}`);
  url.searchParams.set("startDate", fmt(start));
  url.searchParams.set("endDate", fmt(end));
  url.searchParams.set(
    "metrics",
    "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,comments,shares"
  );

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!res.ok) {
    return { error: data.error?.message || "Analytics unavailable (channel may be too new)." };
  }
  const row = data.rows?.[0];
  if (!row) return { error: "No analytics rows for this period yet." };
  const headers = data.columnHeaders.map((h) => h.name);
  const summary = Object.fromEntries(headers.map((h, i) => [h, row[i]]));
  return { periodDays: days, ...summary };
}

module.exports = { getMyChannel, getRecentVideos, getTopComments, getTranscript, getAnalyticsSummary };
