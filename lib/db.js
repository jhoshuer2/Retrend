const { neon } = require("@neondatabase/serverless");

let _sql = null;

function sql(strings, ...values) {
  if (!_sql) {
    const url =
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL_UNPOOLED;
    if (!url) {
      throw new Error(
        "No database connection string found (DATABASE_URL / POSTGRES_URL). " +
          "Connect a Postgres database to this project in the Vercel dashboard (Storage tab), then redeploy."
      );
    }
    _sql = neon(url);
  }
  return _sql(strings, ...values);
}

let ensured = false;

async function ensureTables() {
  if (ensured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      picture TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS oauth_tokens (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      scope TEXT,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS channel_profile (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      name TEXT DEFAULT '',
      niche TEXT DEFAULT '',
      stage TEXT DEFAULT 'new',
      goals TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      youtube_channel_id TEXT,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      why TEXT DEFAULT '',
      role TEXT DEFAULT '',
      run_id TEXT DEFAULT '',
      done BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "timestamp" TIMESTAMPTZ DEFAULT now(),
      question TEXT,
      pasted_data TEXT,
      channel_snapshot JSONB,
      roles JSONB,
      role_results JSONB,
      used_live_data BOOLEAN DEFAULT false
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT DEFAULT 'New conversation',
      character_ids JSONB NOT NULL DEFAULT '[]',
      live_snapshot JSONB,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sender TEXT NOT NULL,
      content TEXT NOT NULL,
      shared_video JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `;

  // Migration: channel_profile / tasks / runs predate multi-user support and
  // were created without a user_id column — CREATE TABLE IF NOT EXISTS is a
  // no-op on a table that already exists, so it never got added. Back-fill it
  // on existing deployments (harmless no-op on a fresh database).
  await sql`ALTER TABLE channel_profile ADD COLUMN IF NOT EXISTS user_id TEXT;`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id TEXT;`;
  await sql`ALTER TABLE runs ADD COLUMN IF NOT EXISTS user_id TEXT;`;
  // channel_profile's upsert relies on ON CONFLICT (user_id), which needs a
  // unique constraint — add one if it's missing (NULLs from legacy rows are
  // fine, Postgres allows multiple NULLs under a UNIQUE constraint).
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'channel_profile_user_id_key'
      ) THEN
        ALTER TABLE channel_profile ADD CONSTRAINT channel_profile_user_id_key UNIQUE (user_id);
      END IF;
    END $$;
  `;

  ensured = true;
}

module.exports = { sql, ensureTables };
