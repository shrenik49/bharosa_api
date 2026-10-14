import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

const DB_DIR = join(__dirname, '..', '..', '..', 'db');

function sqlFiles(folder: string): Array<{ name: string; sql: string }> {
  const dir = join(DB_DIR, folder);
  return readdirSync(dir)
    .filter(file => file.endsWith('.sql'))
    .sort()
    .map(name => ({ name, sql: readFileSync(join(dir, name), 'utf8') }));
}

/** Applies every migration not yet recorded in `schema_migrations`, each in its own transaction. */
export async function migrate(pool: Pool, log: (message: string) => void = console.log): Promise<void> {
  await pool.query(`create table if not exists schema_migrations (
    name text primary key, applied_at timestamptz not null default now())`);
  const applied = await pool.query<{ name: string }>('select name from schema_migrations');
  const done = new Set(applied.rows.map(row => row.name));
  for (const { name, sql } of sqlFiles('migrations')) {
    if (done.has(name)) continue;
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations(name) values ($1)', [name]);
      await client.query('commit');
      log(`applied ${name}`);
    } catch (error) {
      await client.query('rollback');
      throw new Error(`Migration ${name} failed: ${(error as Error).message}`, { cause: error });
    } finally {
      client.release();
    }
  }
}

/** Seed files are idempotent (on conflict do nothing), so running them again is safe. */
export async function seed(pool: Pool, log: (message: string) => void = console.log): Promise<void> {
  for (const { name, sql } of sqlFiles('seeds')) {
    await pool.query(sql);
    log(`seeded ${name}`);
  }
}
