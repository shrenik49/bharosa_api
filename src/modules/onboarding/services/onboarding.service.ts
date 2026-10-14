import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/services/database.service';

const LAUNCH_CITY_SLUG = 'pune';

interface TasteProfileInput {
  tagIds: number[];
  placeIds: string[];
  citySlug?: string;
}

@Injectable()
export class OnboardingService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Port of the app's saveTasteProfile: interests, favourite places, then onboarded_at + city.
   * One transaction, upserts only, so a retry after a network failure never duplicates rows.
   */
  async saveTasteProfile(userId: string, { tagIds, placeIds, citySlug }: TasteProfileInput): Promise<void> {
    await this.db.transaction(async tx => {
      const city = await tx.queryOne<{ id: number }>('select id from cities where slug = $1', [
        citySlug ?? LAUNCH_CITY_SLUG,
      ]);
      if (!city) throw new BadRequestException('Unknown city');

      if (tagIds.length > 0) {
        await tx.query(
          `insert into user_interests(user_id, tag_id, source)
           select $1, t.id, 'onboarding' from tags t where t.id = any($2::int[])
           on conflict (user_id, tag_id) do nothing`,
          [userId, tagIds],
        );
      }

      if (placeIds.length > 0) {
        const list = await tx.queryOne<{ id: string }>(
          `select id from lists where user_id = $1 and kind = 'favorites' order by created_at limit 1`,
          [userId],
        );
        const listId =
          list?.id ??
          (
            await tx.queryOne<{ id: string }>(
              `insert into lists(user_id, name, kind) values ($1, 'Places I love', 'favorites') returning id`,
              [userId],
            )
          )?.id;
        await tx.query(
          `insert into list_items(list_id, place_id)
           select $1, p.id from places p where p.id = any($2::uuid[]) and p.status = 'active'
           on conflict (list_id, place_id) do nothing`,
          [listId, placeIds],
        );
      }

      const updated = await tx.query(
        `update profiles set onboarded_at = coalesce(onboarded_at, now()), city_id = $2
          where id = $1 returning id`,
        [userId, city.id],
      );
      if (updated.length === 0) throw new BadRequestException('Your profile could not be updated.');
    });
  }
}
