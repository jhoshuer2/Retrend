# Multi-Hat — YouTube Growth Crew

A role-based AI assistant for diagnosing and growing a YouTube channel. Pick
one or more "hats" (Content Strategist, SEO Specialist, Data Analyst,
Scriptwriter, Community Manager, Social Media Manager), describe what's
going on, optionally paste in data, and each role gives back a diagnosis,
findings, and trackable actions.

## Setup

1. **Install dependencies**: `npm install`
2. **Environment variables** (set in Vercel Project Settings → Environment
   Variables, or in `.env.local` for local dev — see `.env.example`):
   - `ANTHROPIC_API_KEY` — from console.anthropic.com. Required.
   - `APP_PASSWORD` — a password to gate the whole app (no accounts/auth
     system, just a shared password + cookie). Required to keep random
     visitors from running up your API bill. Leave unset only if you
     understand the app is then open to anyone with the URL.
   - `CLAUDE_MODEL` — optional, defaults to `claude-sonnet-5-5`.
3. **Database**: this app uses Postgres (via `@neondatabase/serverless`) to
   persist your channel profile, tracked tasks, and run history. In the
   Vercel dashboard, open this project → **Storage** → **Create Database**,
   and pick a Postgres option (Neon, via the Vercel Marketplace), then
   connect it to this project. Vercel injects `DATABASE_URL` (and related)
   env vars automatically — you don't set them by hand. Redeploy after
   connecting it.
4. **Deploy**: push to GitHub and import the repo in Vercel, or run
   `vercel --prod` from this directory.

## How it works

- `app/page.js` is the whole frontend (role picker, ask form, tasks,
  history, channel setup).
- `app/api/run/route.js` calls the Anthropic API directly (using
  `ANTHROPIC_API_KEY`) with one request per selected role, using tool-use
  to get back structured JSON (diagnosis / findings / actions / followup).
- `app/api/profile`, `app/api/tasks`, `app/api/runs` persist to Postgres.
- `middleware.js` + `app/login` gate every page and API route behind
  `APP_PASSWORD`.
