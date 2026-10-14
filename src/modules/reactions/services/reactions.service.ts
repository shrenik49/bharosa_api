import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../database/services/database.service';
import { ReactionSubject } from '../dto/reactions.dto';

// What a person is allowed to like, per type (same visibility as reading it). $1 = viewer, $2 = subject id.
// Fixed strings keyed by a validated enum: no client input is ever concatenated into SQL.
const VISIBLE: Record<ReactionSubject, string> = {
  photo: `select 1 from photos where id = $2 and (status = 'approved' or user_id = $1)`,
  review: `select 1 from reviews where id = $2 and not is_hidden and can_see_user($1, user_id)`,
  list: `select 1 from lists where id = $2 and (is_public or user_id = $1)`,
};

/** One generic "like" for photos, reviews and lists. Counters and notifications are maintained by DB triggers. */
@Injectable()
export class ReactionsService {
  constructor(private readonly db: DatabaseService) {}

  async like(userId: string, subjectType: ReactionSubject, subjectId: string): Promise<void> {
    const visible = await this.db.queryOne(VISIBLE[subjectType], [userId, subjectId]);
    if (!visible) throw new NotFoundException(`${subjectType} not found`);
    await this.db.query(
      `insert into reactions(user_id, subject_type, subject_id) values ($1, $2, $3)
       on conflict do nothing`,
      [userId, subjectType, subjectId],
    );
  }

  async unlike(userId: string, subjectType: ReactionSubject, subjectId: string): Promise<void> {
    await this.db.query(
      `delete from reactions where user_id = $1 and subject_type = $2 and subject_id = $3 and kind = 'like'`,
      [userId, subjectType, subjectId],
    );
  }
}
