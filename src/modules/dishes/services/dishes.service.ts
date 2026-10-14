import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService, Queryable } from '../../../database/services/database.service';

/** "What you ate": dishes come from visits, so a place's menu builds itself. */
@Injectable()
export class DishesService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Attaches dishes to one of my verified visits. Unknown names are added to the place's menu.
   * One transaction, safe to repeat: dishes already attached are left as they are.
   */
  async saveForVisit(userId: string, visitId: string, dishIds: string[], newDishNames: string[]): Promise<void> {
    await this.db.transaction(async tx => {
      const visit = await tx.queryOne<{ place_id: string }>(
        `select place_id from visits where id = $1 and user_id = $2 and status = 'verified'`,
        [visitId, userId],
      );
      if (!visit) throw new ForbiddenException('Visit not found or not verified');

      const ids = new Set<string>();
      if (dishIds.length > 0) {
        // Only dishes that belong to this place can be attached to this visit.
        const known = await tx.query<{ id: string }>(
          'select id from dishes where place_id = $1 and id = any($2::uuid[])',
          [visit.place_id, dishIds],
        );
        known.forEach(row => ids.add(row.id));
      }
      for (const name of newDishNames) {
        ids.add(await this.findOrCreate(tx, visit.place_id, name));
      }
      if (ids.size > 0) {
        await tx.query(
          `insert into visit_dishes(visit_id, dish_id) select $1, unnest($2::uuid[]) on conflict do nothing`,
          [visitId, [...ids]],
        );
      }
    });
  }

  private async findOrCreate(tx: Queryable, placeId: string, name: string): Promise<string> {
    // The unique index is on (place_id, lower(name)), so a concurrent insert of the same name is a no-op.
    await tx.query('insert into dishes(place_id, name) values ($1, $2) on conflict do nothing', [placeId, name]);
    const row = await tx.queryOne<{ id: string }>(
      'select id from dishes where place_id = $1 and lower(name) = lower($2)',
      [placeId, name],
    );
    return (row as { id: string }).id;
  }
}
