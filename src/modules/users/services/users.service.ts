import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../database/services/database.service';
import { BadgesService } from '../../badges/services/badges.service';
import { PublicProfileDto, UserRankDto, UserSummaryDto } from '../dto/users.dto';

const SUMMARY = `p.id, p.handle, p.display_name as "displayName", p.avatar_path as "avatarPath", p.is_creator as "isCreator"`;

@Injectable()
export class UsersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly badges: BadgesService,
  ) {}

  /** Find people by handle or name (to add to a circle). Escapes LIKE wildcards in the search text. */
  search(q: string, limit: number, offset: number): Promise<UserSummaryDto[]> {
    const pattern = `%${q.replace(/[\\%_]/g, m => `\\${m}`)}%`;
    return this.db.query<UserSummaryDto>(
      `select ${SUMMARY} from profiles p
        where p.deleted_at is null and (p.handle::text ilike $1 or p.display_name ilike $1)
        order by similarity(p.display_name, $2) desc, p.display_name limit $3 offset $4`,
      [pattern, q, limit, offset],
    );
  }

  async getProfile(viewerId: string, userId: string): Promise<PublicProfileDto> {
    const row = await this.db.queryOne<Omit<PublicProfileDto, 'badges'>>(
      `select ${SUMMARY}, p.bio,
              coalesce(t.verified_visits, 0)::int as "verifiedVisits",
              coalesce(t.places_revisited, 0)::int as "placesRevisited",
              coalesce(t.flags, 0)::int as flags,
              (select cm.relation from circle_members cm where cm.owner_id = $1 and cm.member_id = p.id) as relation
         from profiles p left join user_trust_stats t on t.user_id = p.id
        where p.id = $2 and p.deleted_at is null`,
      [viewerId, userId],
    );
    if (!row) throw new NotFoundException('Person not found');
    return { ...row, badges: await this.badges.forUser(userId) };
  }

  /** Someone's ranked places, only if their "who can see my ratings" setting allows the viewer. */
  async ranks(viewerId: string, userId: string): Promise<UserRankDto[]> {
    const person = await this.db.queryOne<{ allowed: boolean }>(
      `select can_see_user($1, p.id) as allowed from profiles p where p.id = $2 and p.deleted_at is null`,
      [viewerId, userId],
    );
    if (!person) throw new NotFoundException('Person not found');
    if (!person.allowed) throw new ForbiddenException('This person keeps their ratings private.');
    return this.db.query<UserRankDto>(
      `select r.place_id as "placeId", pl.name, r.score
         from user_place_ranks r join places pl on pl.id = r.place_id
        where r.user_id = $1 order by r.rank_key desc`,
      [userId],
    );
  }
}
