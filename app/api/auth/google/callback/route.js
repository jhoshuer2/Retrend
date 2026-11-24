import { NextResponse } from "next/server";
import { sql, ensureTables } from "../../../../../lib/db";
import {
  exchangeCodeForTokens,
  fetchUserInfo,
  createUserSession,
} from "../../../../../lib/google-auth";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = req.cookies.get("mh_oauth_state")?.value;
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, req.url));
  }
  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(new URL("/login?error=state_mismatch", req.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const info = await fetchUserInfo(tokens.access_token);

    await ensureTables();
    await sql`
      INSERT INTO users (id, email, name, picture)
      VALUES (${info.sub}, ${info.email}, ${info.name}, ${info.picture})
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, picture = EXCLUDED.picture;
    `;

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    await sql`
      INSERT INTO oauth_tokens (user_id, access_token, refresh_token, expires_at, scope)
      VALUES (${info.sub}, ${tokens.access_token}, ${tokens.refresh_token || null}, ${expiresAt}, ${tokens.scope || ""})
      ON CONFLICT (user_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, oauth_tokens.refresh_token),
        expires_at = EXCLUDED.expires_at,
        scope = EXCLUDED.scope,
        updated_at = now();
    `;

    const session = await createUserSession(info.sub);
    const res = NextResponse.redirect(new URL("/", req.url));
    res.cookies.set("mh_session", session.token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      expires: new Date(session.expiresAt),
    });
    res.cookies.delete("mh_oauth_state");
    return res;
  } catch (err) {
    console.error("OAuth callback error", err);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(err.message)}`, req.url));
  }
}
