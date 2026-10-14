import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export const RATING_AUDIENCES = ['everyone', 'circle', 'me'] as const;
export type RatingAudience = (typeof RATING_AUDIENCES)[number];

export class UpdateSettingsDto {
  /** Who can see my ratings and reviews. */
  @IsOptional()
  @IsIn(RATING_AUDIENCES)
  ratingAudience?: RatingAudience;

  @IsOptional()
  @IsBoolean()
  circleFirst?: boolean;

  @IsOptional()
  @IsBoolean()
  showCreatorPicks?: boolean;

  @IsOptional()
  @IsBoolean()
  revisitReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  pushActivity?: boolean;
}

export class SettingsDto {
  ratingAudience: RatingAudience;
  circleFirst: boolean;
  showCreatorPicks: boolean;
  revisitReminders: boolean;
  pushActivity: boolean;
}
