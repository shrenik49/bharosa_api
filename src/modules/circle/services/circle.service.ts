import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../database/services/database.service';
import { CircleMemberDto, CircleRelation, TasteTwinDto } from '../dto/circle.dto';

const PERSON = `p.id as "userId", p.handle, p.display_name as "displayName", p.avatar_path as "avatarPath", p.is_creator as "isCreator"`;

/** "Owner trusts member": friends, creators and taste twins are the same table with a different relation. */
@Injectable()
export class CircleService {
  constructor(private readonly db: DatabaseService) {}

  /** People I trust. */
  mine(userId: string): Promise<CircleMemberDto[]> {
    return this.db.query<CircleMemberDto>(
      `select ${PERSON}, cm.relation, cm.created_at as "addedAt"
         from circle_members cm join profiles p on p.id = cm.member_id
        where cm.owner_id = $1 and p.deleted_at is null order by cm.created_at desc`,
      [userId],
    );
  }

  /** People who have added me to their circle. */
  addedMe(userId: string): Promise<CircleMemberDto[]> {
    return this.db.query<CircleMemberDto>(
      `select ${PERSON}, cm.relation, cm.created_at as "addedAt"
         from circle_members cm join profiles p on p.id = cm.owner_id
        where cm.member_id = $1 and p.deleted_at is null order by cm.created_at desc`,
      [userId],
    );
  }

  twins(userId: string): Promise<TasteTwinDto[]> {
    return this.db.query<TasteTwinDto>(
      `select ${PERSON}, ts.score, ts.overlap::int as overlap
         from taste_similarity ts join profiles p on p.id = ts.other_id
        where ts.user_id = $1 and p.deleted_at is null order by ts.score desc`,
      [userId],
    );
  }

  /** Adds someone, or changes the relation if they are already in the circle. The person is notified once. */
  async add(userId: string, memberId: string, relation: CircleRelation = 'friend'): Promise<void> {
    if (memberId === userId) throw new BadRequestException('You cannot add yourself to your own circle.');
    const member = await this.db.queryOne('select 1 from profiles where id = $1 and deleted_at is null', [memberId]);
    if (!member) throw new NotFoundException('Person not found');
    await this.db.query(
      `insert into circle_members(owner_id, member_id, relation) values ($1, $2, $3)
       on conflict (owner_id, member_id) do update set relation = excluded.relation`,
      [userId, memberId, relation],
    );
  }

  async remove(userId: string, memberId: string): Promise<void> {
    await this.db.query('delete from circle_members where owner_id = $1 and member_id = $2', [userId, memberId]);
  }
}
