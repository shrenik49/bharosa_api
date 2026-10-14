import { Pool } from 'pg';
import { migrate, seed } from '../migrator/migrator';

async function main(): Promise<void> {
  try {
    process.loadEnvFile('.env');
  } catch {
    // No .env file: rely on the real environment.
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({
    connectionString: url,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
  try {
    const command = process.argv[2];
    if (command === 'migrate') await migrate(pool);
    else if (command === 'seed') await seed(pool);
    else throw new Error('Usage: cli.ts migrate | seed');
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
