import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ListNotificationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsBoolean()
  unreadOnly: boolean = false;
}

export class NotificationDto {
  id: number;
  /** friend_visit, new_twin, photo_liked, review_liked, list_liked, added_to_circle, invite_redeemed, badge_awarded... */
  type: string;
  actorId: string | null;
  actorName: string | null;
  subjectType: string | null;
  subjectId: string | null;
  data: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}

export class UnreadCountDto {
  count: number;
}
