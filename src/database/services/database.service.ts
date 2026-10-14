import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResultRow, types } from 'pg';
import { EnvVars } from '../../config/env.config';

// Counts and sums come back from Postgres as bigint/numeric strings; our values are far below 2^53.
types.setTypeParser(types.builtins.INT8, value => Number(value));
types.setTypeParser(types.builtins.NUMERIC, value => Number(value));

/** The only thing services need from the database: run SQL, get rows back. Always parameterised. */
export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<T | null>;
}

class TransactionClient implements Queryable {
  constructor(private readonly client: PoolClient) {}

  async query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.client.query<T>(sql, params)).rows;
  }

  async queryOne<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | null> {
    return (await this.query<T>(sql, params))[0] ?? null;
  }
}

@Injectable()
export class DatabaseService implements Queryable, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  readonly pool: Pool;

  constructor(config: ConfigService<EnvVars, true>) {
    this.pool = new Pool({
      connectionString: config.get('DATABASE_URL', { infer: true }),
      ssl: config.get('DATABASE_SSL', { infer: true }) ? { rejectUnauthorized: false } : undefined,
      max: 10,
      // Fail fast instead of hanging a request: a runaway query or a dead database must not pile up callers.
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      statement_timeout: 10_000,
      keepAlive: true,
    });
    // A dropped idle connection (hosted databases recycle them) must not crash the process; the pool replaces it.
    this.pool.on('error', error => this.logger.warn(`idle database connection dropped: ${error.message}`));
  }

  async query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.pool.query<T>(sql, params)).rows;
  }

  async queryOne<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | null> {
    return (await this.query<T>(sql, params))[0] ?? null;
  }

  /** Runs `work` in one transaction: commits if it resolves, rolls back if it throws. */
  async transaction<T>(work: (tx: Queryable) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await work(new TransactionClient(client));
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
