#!/usr/bin/env node
// ============================================================
// Ledger — apply-schema: creates all tables in Supabase
//
// Supabase is the only database. This script just runs the SQL
// files in database/ against your Supabase Postgres so you
// don't have to paste them by hand.
//
// Needs the Postgres connection string in .env:
//   DATABASE_URL=postgresql://postgres:<db-password>@db.<ref>.supabase.co:5432/postgres
// (Supabase → Project Settings → Database → Connection string → URI)
//
// Run: npm run db:setup
// ============================================================
const fs = require("fs");
const path = require("path");
const pg = require("pg");

require("dotenv").config({ path: path.join(__dirname, "../../../.env") });

const ROOT = path.join(__dirname, "../../../database");
const FILES = [
  "schema.sql",
  ...fs.readdirSync(path.join(ROOT, "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort(),
];

async function main() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.error(`
  ✖  DATABASE_URL is not set.

     Add it to .env — find it in Supabase → Project Settings →
     Database → Connection string → URI (use the "Session pooler"
     or direct connection, and paste your DB password in):

       DATABASE_URL=postgresql://postgres:<db-password>@db.<ref>.supabase.co:5432/postgres

     Then run: npm run db:setup
`);
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();

    // ledger so each file only runs once, even though the SQL is idempotent
    await client.query(
      `create table if not exists public.schema_migrations (
         name text primary key,
         applied_at timestamptz not null default now()
       )`
    );
    const { rows } = await client.query("select name from public.schema_migrations");
    const applied = new Set(rows.map((r) => r.name));

    for (const file of FILES) {
      const rel = fs.existsSync(path.join(ROOT, file)) ? file : path.join("migrations", file);
      if (applied.has(rel)) {
        console.log(`  = ${rel} (already applied)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(ROOT, rel), "utf8");
      try {
        await client.query(sql);
        await client.query("insert into public.schema_migrations (name) values ($1)", [rel]);
        console.log(`  ✓ ${rel}`);
      } catch (e) {
        console.error(`  ✖ ${rel} failed:`);
        console.error(`    ${e.message}`);
        process.exitCode = 1;
        break; // stop on first failure — later files may depend on it
      }
    }
  } catch (e) {
    console.error(`  ✖ Could not connect to Supabase Postgres: ${e.message}`);
    console.error("     Check DATABASE_URL and the database password.");
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
