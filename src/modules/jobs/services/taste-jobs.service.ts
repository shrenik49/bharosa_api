import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { EnvVars } from '../../../config/env.config';
import { DatabaseService } from '../../../database/services/database.service';

/** Only people who ranked something recently are worth recomputing every night. */
const ACTIVE_WINDOW_DAYS = 30;
const KEEP_TWINS = 50;
const MIN_OVERLAP = 3;

/**
 * Nightly taste jobs (ports of refresh_user_affinity and refresh_taste_similarity).
 * Not on the request path: they scan many ranks. Run in-process for now; if the API is ever
 * scaled to several instances, move these to a single worker so they do not run twice.
 */
@Injectable()
export class TasteJobs {
  private readonly logger = new Logger(TasteJobs.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  @Cron('0 2 * * *', { timeZone: 'Asia/Kolkata' })
  async nightly(): Promise<void> {
    if (!this.config.get('ENABLE_JOBS', { infer: true })) return;
    const users = await this.activeUsers();
    for (const userId of users) {
      try {
        await this.refreshUserAffinity(userId);
        await this.refreshTasteSimilarity(userId);
      } catch (error) {
        this.logger.error(`taste refresh failed for ${userId}: ${(error as Error).message}`);
      }
    }
    this.logger.log(`refreshed taste data for ${users.length} users`);
  }

  async activeUsers(): Promise<string[]> {
    const rows = await this.db.query<{ user_id: string }>(
      `select distinct user_id from user_place_ranks where updated_at > now() - make_interval(days => $1)`,
      [ACTIVE_WINDOW_DAYS],
    );
    return rows.map(row => row.user_id);
  }

  /** "Your taste" bars: average of the user's scores over places carrying each tag. */
  async refreshUserAffinity(userId: string): Promise<void> {
    await this.db.query(
      `insert into user_tag_affinity(user_id, tag_id, affinity, n_visits, updated_at)
       select $1, pt.tag_id, least(greatest(avg(r.score) / 100.0, 0), 1), count(*), now()
         from user_place_ranks r join place_tags pt on pt.place_id = r.place_id
        where r.user_id = $1
        group by pt.tag_id
       on conflict (user_id, tag_id) do update
         set affinity = excluded.affinity, n_visits = excluded.n_visits, updated_at = now()`,
      [userId],
    );
  }

  /** Taste twins: people whose scores on shared places are closest to this user's. */
  async refreshTasteSimilarity(userId: string): Promise<void> {
    await this.db.transaction(async tx => {
      await tx.query('delete from taste_similarity where user_id = $1', [userId]);
      await tx.query(
        `insert into taste_similarity(user_id, other_id, score, overlap)
         select $1, o.user_id, greatest(0, 1 - avg(abs(o.score - m.score)) / 100.0)::real, count(*)::smallint
           from user_place_ranks m
           join user_place_ranks o on o.place_id = m.place_id and o.user_id <> m.user_id
          where m.user_id = $1
          group by o.user_id
         having count(*) >= $3
          order by 3 desc
          limit $2`,
        [userId, KEEP_TWINS, MIN_OVERLAP],
      );
    });
  }
}
