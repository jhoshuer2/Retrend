# Multi-Hat — YouTube Growth Crew

A role-based AI assistant for diagnosing and growing a YouTube channel. Each
person signs in with their own Google account; pick one or more "hats"
(Content Strategist, SEO Specialist, Data Analyst, Scriptwriter, Community
Manager, Social Media Manager), describe what's going on, and either paste
in data or let it pull your channel's own videos, stats and transcripts
live. Each role gives back a diagnosis, findings, and trackable actions —
scoped privately to your own account.

## Setup

1. **Install dependencies**: `npm install`
2. **Anthropic**: set `ANTHROPIC_API_KEY` (console.anthropic.com) as an env
   var in Vercel.
3. **Google OAuth** (lets each person sign in and grants read-only access to
   their own channel):
   - In [Google Cloud Console](https://console.cloud.google.com), create a
     project, then enable **YouTube Data API v3** and **YouTube Analytics
     API** (APIs & Services → Library).
   - APIs & Services → OAuth consent screen → External. Add scopes
     `youtube.readonly` and `yt-analytics.readonly` (plus the default
     openid/email/profile). While the app is in "Testing" status, only the
     test users you list there can sign in (up to 100) — submit for
     Google's verification to open it to everyone.
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
     → Web application. Authorized redirect URI:
     `https://<your-vercel-domain>/api/auth/google/callback`.
   - Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as env vars in
     Vercel.
4. **Database**: this app uses Postgres (via `@neondatabase/serverless`) to
   persist each user's channel profile, tracked tasks, and run history —
   fully multi-tenant, keyed by Google account. In the Vercel dashboard,
   open this project → **Storage** → **Create Database**, pick a Postgres
   option (Neon, via the Vercel Marketplace), and connect it. Vercel
   injects `DATABASE_URL` automatically.
5. **Deploy**: push to GitHub and import the repo in Vercel, or run
   `vercel --prod` from this directory. Redeploy after adding/changing any
   env var above.

## What YouTube data this actually gets

Via the signed-in user's own OAuth token: channel info and stats, recent
videos (titles, descriptions, thumbnails, tags, view/like/comment counts,
publish dates), top public comments, caption/transcript text where
available, and channel-level analytics (views, watch time, average view
duration/percentage, subscribers gained/lost, likes/comments/shares) over
a trailing window.

**Not available, OAuth or not**: impressions and thumbnail click-through
rate. YouTube only exposes those inside Studio's UI, not through any public
API — the app says so rather than guessing.

## How it works

- `app/page.js` is the whole frontend (role picker, ask form, tasks,
  history, channel setup, live-data toggle).
- `app/api/auth/google/*` — OAuth start/callback; sessions are stored in
  Postgres and referenced by an httpOnly cookie.
- `proxy.js` (Next's middleware convention) gates every page/API route on a
  valid session, and forwards the resolved user id to routes via an
  `x-user-id` header.
- `app/api/run/route.js` calls the Anthropic API directly, one request per
  selected role, using a strict tool-use schema for structured JSON
  (diagnosis / findings / actions / followup). When live data is used, it
  also sends video thumbnails as images.
- `app/api/youtube/*` fetch the signed-in user's channel/videos/analytics
  from Google.
- `app/api/profile`, `app/api/tasks`, `app/api/runs` persist to Postgres,
  scoped per user.
