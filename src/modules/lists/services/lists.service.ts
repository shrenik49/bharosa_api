import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../database/services/database.service';
import {
  BeenThereDto,
  CreateListDto,
  ListDetailDto,
  ListItemDto,
  ListSummaryDto,
  UpdateListDto,
} from '../dto/lists.dto';

const SUMMARY = `l.id, l.name, l.kind, l.is_public as "isPublic", l.like_count as "likeCount",
                 (select count(*) from list_items li where li.list_id = l.id)::int as "itemCount"`;

@Injectable()
export class ListsService {
  constructor(private readonly db: DatabaseService) {}

  mine(userId: string): Promise<ListSummaryDto[]> {
    return this.db.query<ListSummaryDto>(
      `select ${SUMMARY} from lists l where l.user_id = $1 order by l.kind = 'want' desc, l.created_at`,
      [userId],
    );
  }

  /** Places the person has a verified visit at ("Been there" tab). */
  beenThere(userId: string): Promise<BeenThereDto[]> {
    return this.db.query<BeenThereDto>(
      `select b.place_id as "placeId", p.name, a.name as area, b.visits::int as visits, b.last_visit as "lastVisit"
         from been_there b join places p on p.id = b.place_id left join areas a on a.id = p.area_id
        where b.user_id = $1 order by b.last_visit desc`,
      [userId],
    );
  }

  async create(userId: string, { name, isPublic = false }: CreateListDto): Promise<ListSummaryDto> {
    const row = await this.db.queryOne<{ id: string }>(
      `insert into lists(user_id, name, kind, is_public) values ($1, $2, 'custom', $3) returning id`,
      [userId, name, isPublic],
    );
    return this.summary(userId, (row as { id: string }).id);
  }

  /** A list is visible to its owner, and to everyone once it is public. */
  async get(viewerId: string, listId: string): Promise<ListDetailDto> {
    const list = await this.db.queryOne<ListSummaryDto & { ownerId: string }>(
      `select ${SUMMARY}, l.user_id as "ownerId" from lists l
        where l.id = $1 and (l.user_id = $2 or l.is_public)`,
      [listId, viewerId],
    );
    if (!list) throw new NotFoundException('List not found');
    const items = await this.db.query<ListItemDto>(
      `select li.place_id as "placeId", p.name, a.name as area, li.note, li.added_at as "addedAt"
         from list_items li join places p on p.id = li.place_id left join areas a on a.id = p.area_id
        where li.list_id = $1 order by li.added_at desc`,
      [listId],
    );
    return { ...list, items };
  }

  async update(userId: string, listId: string, dto: UpdateListDto): Promise<ListSummaryDto> {
    const updated = await this.db.queryOne(
      `update lists set name = coalesce($3, name), is_public = coalesce($4, is_public)
        where id = $1 and user_id = $2 returning id`,
      [listId, userId, dto.name ?? null, dto.isPublic ?? null],
    );
    if (!updated) throw new NotFoundException('List not found');
    return this.summary(userId, listId);
  }

  async remove(userId: string, listId: string): Promise<void> {
    const list = await this.db.queryOne<{ kind: string }>('select kind from lists where id = $1 and user_id = $2', [
      listId,
      userId,
    ]);
    if (!list) throw new NotFoundException('List not found');
    if (list.kind === 'want') throw new ForbiddenException('"Want to try" cannot be deleted.');
    await this.db.query('delete from lists where id = $1', [listId]);
  }

  async addItem(userId: string, listId: string, placeId: string, note?: string): Promise<void> {
    await this.assertOwner(userId, listId);
    const place = await this.db.queryOne('select 1 from places where id = $1 and status = $2', [placeId, 'active']);
    if (!place) throw new NotFoundException('Place not found');
    await this.db.query(
      `insert into list_items(list_id, place_id, note) values ($1, $2, $3)
       on conflict (list_id, place_id) do update set note = excluded.note`,
      [listId, placeId, note ?? null],
    );
  }

  async removeItem(userId: string, listId: string, placeId: string): Promise<void> {
    await this.assertOwner(userId, listId);
    await this.db.query('delete from list_items where list_id = $1 and place_id = $2', [listId, placeId]);
  }

  private async assertOwner(userId: string, listId: string): Promise<void> {
    const owned = await this.db.queryOne('select 1 from lists where id = $1 and user_id = $2', [listId, userId]);
    if (!owned) throw new NotFoundException('List not found');
  }

  private async summary(userId: string, listId: string): Promise<ListSummaryDto> {
    const row = await this.db.queryOne<ListSummaryDto>(
      `select ${SUMMARY} from lists l where l.id = $1 and l.user_id = $2`,
      [listId, userId],
    );
    return row as ListSummaryDto;
  }
}
