const { getValidAccessToken } = require("./google-auth");
const { getMyChannel, getRecentVideos, getAnalyticsSummary } = require("./youtube");

// Pulls a fresh { channel, analytics, videos } snapshot for this user, or
// returns null (never throws) so callers can fail soft and keep chatting
// without live data.
async function tryFetchLiveSnapshot(userId, maxVideos = 8) {
  try {
    const accessToken = await getValidAccessToken(userId);
    const channel = await getMyChannel(accessToken);
    if (!channel) return null;
    const [analytics, videos] = await Promise.all([
      getAnalyticsSummary(accessToken, channel.id, 28).catch((e) => ({ error: e.message })),
      channel.uploadsPlaylistId
        ? getRecentVideos(accessToken, channel.uploadsPlaylistId, maxVideos).catch(() => [])
        : Promise.resolve([]),
    ]);
    return { channel, analytics, videos };
  } catch (e) {
    return null;
  }
}

module.exports = { tryFetchLiveSnapshot };
