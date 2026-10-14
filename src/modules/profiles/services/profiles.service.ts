import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../database/services/database.service';
import { ProfileResponseDto, UpdateProfileDto } from '../dto/profiles.dto';

interface ProfileRow {
  id: string;
  email: string;
  handle: string;
  display_name: string;
  avatar_path: string | null;
  bio: string | null;
  city_id: number | null;
  area_id: number | null;
  is_creator: boolean;
  onboarded_at: Date | null;
  rating_audience: string;
  circle_first: boolean;
  show_creator_picks: boolean;
  revisit_reminders: boolean;
  push_activity: boolean;
  verified_visits: number | null;
  places_revisited: number | null;
  flags: number | null;
}

// API field -> column. Only these can be written by the client; onboarded_at and is_creator never can.
const EDITABLE: Record<keyof UpdateProfileDto, string> = {
  handle: 'handle',
  displayName: 'display_name',
  avatarPath: 'avatar_path',
  bio: 'bio',
  cityId: 'city_id',
  areaId: 'area_id',
};

@Injectable()
export class ProfilesService {
  constructor(private readonly db: DatabaseService) {}

  async getMe(userId: string): Promise<ProfileResponseDto> {
    const row = await this.db.queryOne<ProfileRow>(
      `select p.id, u.email, p.handle, p.display_name, p.avatar_path, p.bio, p.city_id, p.area_id,
              p.is_creator, p.onboarded_at,
              s.rating_audience, s.circle_first, s.show_creator_picks, s.revisit_reminders, s.push_activity,
              t.verified_visits, t.places_revisited, t.flags
         from profiles p
         join users u on u.id = p.id
         join user_settings s on s.user_id = p.id
         left join user_trust_stats t on t.user_id = p.id
        where p.id = $1 and p.deleted_at is null`,
      [userId],
    );
    if (!row) throw new NotFoundException('Profile not found');
    return {
      id: row.id,
      email: row.email,
      handle: row.handle,
      displayName: row.display_name,
      avatarPath: row.avatar_path,
      bio: row.bio,
      cityId: row.city_id,
      areaId: row.area_id,
      isCreator: row.is_creator,
      onboarded: row.onboarded_at !== null,
      settings: {
        ratingAudience: row.rating_audience,
        circleFirst: row.circle_first,
        showCreatorPicks: row.show_creator_picks,
        revisitReminders: row.revisit_reminders,
        pushActivity: row.push_activity,
      },
      trust: {
        verifiedVisits: row.verified_visits ?? 0,
        placesRevisited: row.places_revisited ?? 0,
        flags: row.flags ?? 0,
      },
    };
  }

  async update(userId: string, dto: UpdateProfileDto): Promise<ProfileResponseDto> {
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [field, column] of Object.entries(EDITABLE) as Array<[keyof UpdateProfileDto, string]>) {
      if (dto[field] !== undefined) {
        values.push(dto[field]);
        sets.push(`${column} = $${values.length}`);
      }
    }
    if (sets.length > 0) {
      values.push(userId);
      await this.db.query(`update profiles set ${sets.join(', ')} where id = $${values.length}`, values);
    }
    return this.getMe(userId);
  }
}
