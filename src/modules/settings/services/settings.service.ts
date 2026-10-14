import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/services/database.service';
import { SettingsDto, UpdateSettingsDto } from '../dto/settings.dto';

// API field -> column. A fixed whitelist, so the dynamic SET clause never contains client input.
const COLUMNS: Record<keyof UpdateSettingsDto, string> = {
  ratingAudience: 'rating_audience',
  circleFirst: 'circle_first',
  showCreatorPicks: 'show_creator_picks',
  revisitReminders: 'revisit_reminders',
  pushActivity: 'push_activity',
};

@Injectable()
export class SettingsService {
  constructor(private readonly db: DatabaseService) {}

  async get(userId: string): Promise<SettingsDto> {
    const row = await this.db.queryOne<SettingsDto>(
      `select rating_audience as "ratingAudience", circle_first as "circleFirst",
              show_creator_picks as "showCreatorPicks", revisit_reminders as "revisitReminders",
              push_activity as "pushActivity"
         from user_settings where user_id = $1`,
      [userId],
    );
    return row as SettingsDto;
  }

  async update(userId: string, dto: UpdateSettingsDto): Promise<SettingsDto> {
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [field, column] of Object.entries(COLUMNS) as Array<[keyof UpdateSettingsDto, string]>) {
      if (dto[field] !== undefined) {
        values.push(dto[field]);
        sets.push(`${column} = $${values.length}`);
      }
    }
    if (sets.length > 0) {
      values.push(userId);
      await this.db.query(`update user_settings set ${sets.join(', ')} where user_id = $${values.length}`, values);
    }
    return this.get(userId);
  }
}
