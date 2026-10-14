import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../database/services/database.service';
import { BadgeDto } from '../dto/badges.dto';

interface BadgeRule {
  code: string;
  rule: Record<string, number>;
}

/**
 * Badges are data: a row in `badges` with a JSON rule. Add the check for a new code in `earned()`.
 *   regular: went back to the same place `revisits`+ times
 *   honest : `verified`+ verified visits and no more than `flags` upheld reports
 *   early  : ranked a place before `first_n` other people had
 */
@Injectable()
export class BadgesService {
  private readonly logger = new Logger(BadgesService.name);

  constructor(private readonly db: DatabaseService) {}

  /** All badges, with `awardedAt` filled in for the ones this user has. */
  catalog(userId: string): Promise<BadgeDto[]> {
    return this.db.query<BadgeDto>(
      `select b.code, b.name, b.description, ub.awarded_at as "awardedAt"
         from badges b left join user_badges ub on ub.badge_code = b.code and ub.user_id = $1
        order by b.code`,
      [userId],
    );
  }

  forUser(userId: string): Promise<BadgeDto[]> {
    return this.db.query<BadgeDto>(
      `select b.code, b.name, b.description, ub.awarded_at as "awardedAt"
         from user_badges ub join badges b on b.code = ub.badge_code
        where ub.user_id = $1 order by ub.awarded_at`,
      [userId],
    );
  }

  /** Awards any newly earned badges and notifies the user. Never throws: it must not break the action that triggered it. */
  async evaluate(userId: string): Promise<string[]> {
    try {
      const pending = await this.db.query<BadgeRule>(
        `select b.code, b.rule from badges b
          where not exists (select 1 from user_badges ub where ub.user_id = $1 and ub.badge_code = b.code)`,
        [userId],
      );
      const awarded: string[] = [];
      for (const badge of pending) {
        if (!(await this.earned(userId, badge))) continue;
        const row = await this.db.queryOne(
          `insert into user_badges(user_id, badge_code) values ($1, $2) on conflict do nothing returning badge_code`,
          [userId, badge.code],
        );
        if (row) {
          awarded.push(badge.code);
          await this.db.query(
            `insert into notifications(user_id, type, data) values ($1, 'badge_awarded', jsonb_build_object('code', $2::text))`,
            [userId, badge.code],
          );
        }
      }
      return awarded;
    } catch (error) {
      this.logger.error(`badge evaluation failed for ${userId}: ${(error as Error).message}`);
      return [];
    }
  }

  private async earned(userId: string, { code, rule }: BadgeRule): Promise<boolean> {
    switch (code) {
      case 'regular': {
        const row = await this.db.queryOne(
          `select 1 from visits where user_id = $1 and status = 'verified'
            group by place_id having count(*) >= $2 limit 1`,
          [userId, rule.revisits ?? 3],
        );
        return row !== null;
      }
      case 'honest': {
        const row = await this.db.queryOne(
          `select 1 from user_trust_stats where user_id = $1 and verified_visits >= $2 and flags <= $3`,
          [userId, rule.verified ?? 30, rule.flags ?? 0],
        );
        return row !== null;
      }
      case 'early': {
        const row = await this.db.queryOne(
          `select 1 from comparisons c
            where c.user_id = $1
              and (select count(distinct c2.user_id) from comparisons c2
                    where c2.place_id = c.place_id and c2.user_id <> $1 and c2.created_at < c.created_at) < $2
            limit 1`,
          [userId, rule.first_n ?? 50],
        );
        return row !== null;
      }
      default:
        return false;
    }
  }
}
