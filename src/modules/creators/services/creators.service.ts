import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../database/services/database.service';
import { CreatorDto, UpdateCreatorProfileDto } from '../dto/creators.dto';

const CREATOR = `p.id as "userId", p.handle, p.display_name as "displayName", p.avatar_path as "avatarPath",
  cp.tagline, cp.links, cp.disclosure_policy as "disclosurePolicy", cp.verified_at as "verifiedAt",
  coalesce(cs.verified_visits, 0)::int as "verifiedVisits", cs.paid_own_pct as "paidOwnPct",
  coalesce(cs.sponsored_flagged, 0)::int as "sponsoredFlagged"`;

const FROM = `from profiles p
  join creator_profiles cp on cp.user_id = p.id
  left join creator_stats cs on cs.user_id = p.id`;

/** Creator transparency screen: what a creator says about themselves next to numbers derived from their visits. */
@Injectable()
export class CreatorsService {
  constructor(private readonly db: DatabaseService) {}

  list(limit: number, offset: number): Promise<CreatorDto[]> {
    return this.db.query<CreatorDto>(
      `select ${CREATOR} ${FROM} where p.is_creator and p.deleted_at is null
        order by cs.verified_visits desc nulls last, p.display_name limit $1 offset $2`,
      [limit, offset],
    );
  }

  async get(userId: string): Promise<CreatorDto> {
    const row = await this.db.queryOne<CreatorDto>(
      `select ${CREATOR} ${FROM} where p.id = $1 and p.deleted_at is null`,
      [userId],
    );
    if (!row) throw new NotFoundException('Creator not found');
    return row;
  }

  /** Creates or updates my creator page. Being listed as a creator (is_creator) and verification are set by us, not here. */
  async upsertMine(userId: string, dto: UpdateCreatorProfileDto): Promise<CreatorDto> {
    await this.db.query(
      `insert into creator_profiles(user_id, tagline, links, disclosure_policy)
       values ($1, $2, coalesce($3::jsonb, '{}'::jsonb), $4)
       on conflict (user_id) do update set
         tagline = coalesce($2, creator_profiles.tagline),
         links = coalesce($3::jsonb, creator_profiles.links),
         disclosure_policy = coalesce($4, creator_profiles.disclosure_policy)`,
      [userId, dto.tagline ?? null, dto.links ? JSON.stringify(dto.links) : null, dto.disclosurePolicy ?? null],
    );
    return this.get(userId);
  }
}
