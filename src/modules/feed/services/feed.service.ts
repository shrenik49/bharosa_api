import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../database/services/database.service';
import { FeedItemDto } from '../dto/feed.dto';

/** How much a person's rating counts toward a place's "match", by how the viewer relates to them. */
export const TRUST_WEIGHTS = {
  friend: 1.0,
  creator: 0.6,
  stranger: 0.1,
} as const;

/** Shrinks scores toward the middle so one rating can never make a 100: (sum(w*s) + 50*1) / (sum(w) + 1). */
const PRIOR_SCORE = 50;
const PRIOR_WEIGHT = 1;

/**
 * Discover feed (port of discover_feed).
 *   match = trust-weighted average of what rankers scored the place; a ranker's weight is
 *   circle friend 1.0, creator 0.6, taste twin = similarity, anyone else 0.1.
 * The score is an anonymous aggregate over everyone's ranks, but names and voucher counts only
 * include people whose ratings the viewer may see (can_see_user), so a private rater is never revealed.
 */
@Injectable()
export class FeedService {
  constructor(private readonly db: DatabaseService) {}

  /** `filter` is 'all', 'circle', or a tag slug such as 'street-food', 'cafe', 'late-night'. */
  async discover(
    viewerId: string,
    citySlug: string,
    filter: string,
    limit: number,
    offset: number,
  ): Promise<FeedItemDto[]> {
    const city = await this.db.queryOne<{ id: number }>('select id from cities where slug = $1', [citySlug]);
    if (!city) throw new NotFoundException('Unknown city');

    return this.db.query<FeedItemDto>(
      `with cand as (
         select p.id, p.name, p.lat, p.lng, a.name as area
           from places p
           left join areas a on a.id = p.area_id
          where p.city_id = $1 and p.status = 'active'
            and ($3 in ('all', 'circle')
                 or exists (select 1 from place_tags pt join tags t on t.id = pt.tag_id
                             where pt.place_id = p.id and t.slug = $3))
       ),
       w as (
         select c.id as place_id, r.user_id, r.score,
                case when cm.relation = 'friend'  then $5::float
                     when cm.relation = 'creator' then $6::float
                     when ts.score is not null    then ts.score::float
                     else $7::float end as weight,
                (cm.relation = 'friend' and can_see_user($2, r.user_id)) as is_circle
           from cand c
           join user_place_ranks r on r.place_id = c.id
           left join circle_members cm on cm.owner_id = $2 and cm.member_id = r.user_id
           left join taste_similarity ts on ts.user_id = $2 and ts.other_id = r.user_id
       ),
       agg as (
         select place_id,
                (sum(weight * score) + $8::float * $9::float) / (sum(weight) + $9::float) as match,
                count(*) filter (where is_circle) as vouchers
           from w group by place_id
       )
       select c.id as "placeId", c.name, c.area, c.lat, c.lng,
              coalesce(round(agg.match), $8::float)::int as match,
              coalesce(s.verified_visits, 0)::int as "verifiedVisits",
              (case when coalesce(s.unique_visitors, 0) = 0 then 0
                    else round(100.0 * s.repeat_visitors / s.unique_visitors) end)::int as "repeatPct",
              coalesce(agg.vouchers, 0)::int as vouchers,
              coalesce((select array_agg(pr.display_name order by pr.display_name)
                          from (select w2.user_id from w w2
                                 where w2.place_id = c.id and w2.is_circle limit 2) q
                          join profiles pr on pr.id = q.user_id), '{}') as "voucherNames"
         from cand c
         left join agg on agg.place_id = c.id
         left join place_stats s on s.place_id = c.id
        where $3 <> 'circle' or coalesce(agg.vouchers, 0) > 0
        order by coalesce(agg.match, $8::float) desc, coalesce(s.verified_visits, 0) desc, c.name
        limit $4 offset $10`,
      [
        city.id,
        viewerId,
        filter,
        limit,
        TRUST_WEIGHTS.friend,
        TRUST_WEIGHTS.creator,
        TRUST_WEIGHTS.stranger,
        PRIOR_SCORE,
        PRIOR_WEIGHT,
        offset,
      ],
    );
  }
}
