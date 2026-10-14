import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../database/services/database.service';
import { NotificationDto } from '../dto/notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly db: DatabaseService) {}

  list(userId: string, unreadOnly: boolean, limit: number, offset: number): Promise<NotificationDto[]> {
    return this.db.query<NotificationDto>(
      `select n.id, n.type, n.actor_id as "actorId", a.display_name as "actorName",
              n.subject_type as "subjectType", n.subject_id as "subjectId", n.data,
              n.read_at as "readAt", n.created_at as "createdAt"
         from notifications n left join profiles a on a.id = n.actor_id
        where n.user_id = $1 and (not $2 or n.read_at is null)
        order by n.created_at desc, n.id desc limit $3 offset $4`,
      [userId, unreadOnly, limit, offset],
    );
  }

  async unreadCount(userId: string): Promise<number> {
    const row = await this.db.queryOne<{ count: number }>(
      'select count(*)::int as count from notifications where user_id = $1 and read_at is null',
      [userId],
    );
    return row?.count ?? 0;
  }

  async markRead(userId: string, id: number): Promise<void> {
    const updated = await this.db.queryOne(
      'update notifications set read_at = coalesce(read_at, now()) where id = $1 and user_id = $2 returning id',
      [id, userId],
    );
    if (!updated) throw new NotFoundException('Notification not found');
  }

  async markAllRead(userId: string): Promise<void> {
    await this.db.query('update notifications set read_at = now() where user_id = $1 and read_at is null', [userId]);
  }
}
