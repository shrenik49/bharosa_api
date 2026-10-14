import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, Queryable } from '../../../database/services/database.service';
import { BadgesService } from '../../badges/services/badges.service';
import { ComparisonOutcome, RankedPlaceDto, ScoreDto } from '../dto/rankings.dto';

/**
 * Ranking by comparison (port of submit_comparison + rescore_user).
 * `rank_key` is a fractional position (higher = better): placing a place between two neighbours is
 * one write with no renumbering. `score` (0-100) is derived from the ordering.
 */
@Injectable()
export class RankingsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly badges: BadgesService,
  ) {}

  async submitComparison(
    userId: string,
    visitId: string,
    refPlaceId: string,
    outcome: ComparisonOutcome,
  ): Promise<ScoreDto> {
    const result = await this.db.transaction(async tx => {
      // Serialise one user's ranking writes so two quick comparisons cannot pick the same neighbour.
      await tx.query('select pg_advisory_xact_lock(hashtext($1))', [userId]);

      const visit = await tx.queryOne<{ id: string; place_id: string }>(
        `select id, place_id from visits where id = $1 and user_id = $2 and status = 'verified'`,
        [visitId, userId],
      );
      if (!visit) throw new ForbiddenException('Visit not found or not verified');
      if (visit.place_id === refPlaceId) throw new ForbiddenException('Cannot compare a place with itself');

      const ref = await tx.queryOne('select 1 from places where id = $1 and status = $2', [refPlaceId, 'active']);
      if (!ref) throw new NotFoundException('Unknown place to compare with');

      await tx.query(
        `insert into comparisons(user_id, place_id, ref_place_id, outcome, visit_id) values ($1, $2, $3, $4, $5)`,
        [userId, visit.place_id, refPlaceId, outcome, visit.id],
      );

      const refRow = await tx.queryOne<{ rank_key: number }>(
        'select rank_key from user_place_ranks where user_id = $1 and place_id = $2',
        [userId, refPlaceId],
      );
      let refKey = refRow?.rank_key;
      if (refKey === undefined) {
        // First ever comparison for this place: the reference place enters the list too.
        refKey = 0;
        await tx.query('insert into user_place_ranks(user_id, place_id, rank_key) values ($1, $2, $3)', [
          userId,
          refPlaceId,
          refKey,
        ]);
      }
      // Re-rating a place moves it, so take it out before looking for neighbours.
      await tx.query('delete from user_place_ranks where user_id = $1 and place_id = $2', [userId, visit.place_id]);

      const newKey = await this.positionFor(tx, userId, refKey, outcome);
      await tx.query('insert into user_place_ranks(user_id, place_id, rank_key) values ($1, $2, $3)', [
        userId,
        visit.place_id,
        newKey,
      ]);

      await this.rescoreUser(tx, userId);
      const scored = await tx.queryOne<{ score: number }>(
        'select score from user_place_ranks where user_id = $1 and place_id = $2',
        [userId, visit.place_id],
      );
      return { score: scored?.score ?? 50 };
    });
    void this.badges.evaluate(userId);
    return result;
  }

  /** Where the compared place goes, relative to the reference place's key. */
  private async positionFor(
    tx: Queryable,
    userId: string,
    refKey: number,
    outcome: ComparisonOutcome,
  ): Promise<number> {
    if (outcome === 'same') return refKey;
    if (outcome === 'better') {
      const next = await tx.queryOne<{ k: number | null }>(
        'select min(rank_key) as k from user_place_ranks where user_id = $1 and rank_key > $2',
        [userId, refKey],
      );
      return next?.k == null ? refKey + 1 : (refKey + next.k) / 2;
    }
    const prev = await tx.queryOne<{ k: number | null }>(
      'select max(rank_key) as k from user_place_ranks where user_id = $1 and rank_key < $2',
      [userId, refKey],
    );
    return prev?.k == null ? refKey - 1 : (refKey + prev.k) / 2;
  }

  /** Scores 0-100 by position: worst = 0, best = 100, ties share a score; a lone place is 100. */
  private async rescoreUser(tx: Queryable, userId: string): Promise<void> {
    await tx.query(
      `update user_place_ranks r set score = x.s, updated_at = now()
         from (
           select place_id,
                  case when count(*) over () = 1 then 100.0
                       else 100.0 * (rank() over (order by rank_key) - 1) / (count(*) over () - 1) end as s
             from user_place_ranks where user_id = $1
         ) x
        where r.user_id = $1 and r.place_id = x.place_id`,
      [userId],
    );
  }

  /** The caller's own ranked list, best first. */
  listMine(userId: string): Promise<RankedPlaceDto[]> {
    return this.db.query<RankedPlaceDto>(
      `select r.place_id as "placeId", p.name, a.name as area, r.score
         from user_place_ranks r join places p on p.id = r.place_id left join areas a on a.id = p.area_id
        where r.user_id = $1 order by r.rank_key desc`,
      [userId],
    );
  }
}
