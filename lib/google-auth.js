const { sql, ensureTables } = require("./db");

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
].join(" ");

function getRedirectUri() {
  const base =
    process.env.APP_BASE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null);
  if (!base) {
    throw new Error("Set APP_BASE_URL (e.g. https://retrend-lake.vercel.app) as an env var.");
  }
  return `${base}/api/auth/google/callback`;
}

function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCodeForTokens(code) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Token exchange failed.");
  return data; // { access_token, refresh_token, expires_in, scope, id_token }
}

async function fetchUserInfo(accessToken) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Could not fetch Google user info.");
  return res.json(); // { sub, email, name, picture }
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Token refresh failed.");
  return data; // { access_token, expires_in, scope }
}

async function createUserSession(userId, days = 30) {
  await ensureTables();
  const token = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  await sql`INSERT INTO sessions (token, user_id, expires_at) VALUES (${token}, ${userId}, ${expiresAt});`;
  return { token, expiresAt };
}

async function getUserIdForSession(token) {
  if (!token) return null;
  await ensureTables();
  const rows = await sql`SELECT user_id FROM sessions WHERE token = ${token} AND expires_at > now();`;
  return rows[0]?.user_id || null;
}

async function deleteSession(token) {
  await ensureTables();
  await sql`DELETE FROM sessions WHERE token = ${token};`;
}

// Returns a valid access token for this user, refreshing it first if expired.
async function getValidAccessToken(userId) {
  await ensureTables();
  const rows = await sql`SELECT * FROM oauth_tokens WHERE user_id = ${userId};`;
  const row = rows[0];
  if (!row) throw new Error("No YouTube access on file for this user — sign in again.");

  const expiresAt = new Date(row.expires_at).getTime();
  if (Date.now() < expiresAt - 60 * 1000) {
    return row.access_token;
  }
  if (!row.refresh_token) {
    throw new Error("YouTube access expired and there's no refresh token — sign in again.");
  }
  const refreshed = await refreshAccessToken(row.refresh_token);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await sql`
    UPDATE oauth_tokens SET access_token = ${refreshed.access_token}, expires_at = ${newExpiresAt}, updated_at = now()
    WHERE user_id = ${userId};
  `;
  return refreshed.access_token;
}

module.exports = {
  SCOPES,
  buildAuthUrl,
  exchangeCodeForTokens,
  fetchUserInfo,
  refreshAccessToken,
  createUserSession,
  getUserIdForSession,
  deleteSession,
  getValidAccessToken,
};
