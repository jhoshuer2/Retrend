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
    CREATE TABLE IF NOT EXISTS channel_profile (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT DEFAULT '',
      niche TEXT DEFAULT '',
      stage TEXT DEFAULT 'new',
      goals TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
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
      "timestamp" TIMESTAMPTZ DEFAULT now(),
      question TEXT,
      pasted_data TEXT,
      channel_snapshot JSONB,
      roles JSONB,
      role_results JSONB
    );
  `;
  ensured = true;
}

module.exports = { sql, ensureTables };
