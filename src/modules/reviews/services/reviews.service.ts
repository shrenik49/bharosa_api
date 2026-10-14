import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../database/services/database.service';
import { ReviewDto } from '../dto/reviews.dto';

const REVIEW = `r.id, r.place_id as "placeId", r.body, r.like_count as "likeCount", r.created_at as "createdAt",
  p.id as "authorId", p.display_name as "authorName", p.handle as "authorHandle",
  exists (select 1 from reactions x where x.user_id = $1 and x.subject_type = 'review'
           and x.subject_id = r.id and x.kind = 'like') as "likedByMe"`;

@Injectable()
export class ReviewsService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * "A line for your circle": only on a verified visit of your own (also enforced by a database trigger).
   * One review per visit, so saving again replaces the text instead of failing.
   */
  async create(userId: string, visitId: string, body: string): Promise<ReviewDto> {
    const visit = await this.db.queryOne<{ place_id: string }>(
      `select place_id from visits where id = $1 and user_id = $2 and status = 'verified'`,
      [visitId, userId],
    );
    if (!visit) throw new ForbiddenException('Visit not found or not verified');
    const row = await this.db.queryOne<{ id: string }>(
      `insert into reviews(visit_id, user_id, place_id, body) values ($1, $2, $3, $4)
       on conflict (visit_id) do update set body = excluded.body
       returning id`,
      [visitId, userId, visit.place_id, body],
    );
    return this.getOne(userId, (row as { id: string }).id);
  }

  async update(userId: string, reviewId: string, body: string): Promise<ReviewDto> {
    const updated = await this.db.queryOne('update reviews set body = $3 where id = $1 and user_id = $2 returning id', [
      reviewId,
      userId,
      body,
    ]);
    if (!updated) throw new NotFoundException('Review not found');
    return this.getOne(userId, reviewId);
  }

  async remove(userId: string, reviewId: string): Promise<void> {
    const deleted = await this.db.queryOne('delete from reviews where id = $1 and user_id = $2 returning id', [
      reviewId,
      userId,
    ]);
    if (!deleted) throw new NotFoundException('Review not found');
  }

  /** Reviews follow each author's "who can see my ratings" setting. */
  forPlace(
    viewerId: string,
    placeId: string,
    circleOnly: boolean,
    limit: number,
    offset: number,
  ): Promise<ReviewDto[]> {
    return this.db.query<ReviewDto>(
      `select ${REVIEW} from reviews r join profiles p on p.id = r.user_id
        where r.place_id = $2 and not r.is_hidden and p.deleted_at is null and can_see_user($1, r.user_id)
          and (not $3 or exists (select 1 from circle_members cm where cm.owner_id = $1 and cm.member_id = r.user_id))
        order by r.created_at desc limit $4 offset $5`,
      [viewerId, placeId, circleOnly, limit, offset],
    );
  }

  mine(userId: string, limit: number, offset: number): Promise<ReviewDto[]> {
    return this.db.query<ReviewDto>(
      `select ${REVIEW} from reviews r join profiles p on p.id = r.user_id
        where r.user_id = $1 and not r.is_hidden order by r.created_at desc limit $2 offset $3`,
      [userId, limit, offset],
    );
  }

  private async getOne(viewerId: string, reviewId: string): Promise<ReviewDto> {
    const row = await this.db.queryOne<ReviewDto>(
      `select ${REVIEW} from reviews r join profiles p on p.id = r.user_id where r.id = $2`,
      [viewerId, reviewId],
    );
    return row as ReviewDto;
  }
}
