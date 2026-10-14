import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class UpdateProfileDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^[a-z0-9_]{3,24}$/, { message: 'handle must be 3-24 letters, numbers or underscores' })
  handle?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  avatarPath?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  bio?: string;

  @IsOptional()
  @IsInt()
  cityId?: number;

  @IsOptional()
  @IsInt()
  areaId?: number;
}

export class ProfileSettingsDto {
  ratingAudience: string;
  circleFirst: boolean;
  showCreatorPicks: boolean;
  revisitReminders: boolean;
  pushActivity: boolean;
}

export class TrustRecordDto {
  verifiedVisits: number;
  placesRevisited: number;
  flags: number;
}

export class ProfileResponseDto {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  avatarPath: string | null;
  bio: string | null;
  cityId: number | null;
  areaId: number | null;
  isCreator: boolean;
  /** True once the taste quiz is finished. */
  onboarded: boolean;
  settings: ProfileSettingsDto;
  trust: TrustRecordDto;
}

export class TasteInterestDto {
  tagId: number;
  name: string;
  kind: string;
}

export class TasteAffinityDto {
  tagId: number;
  name: string;
  /** 0 to 1: how strongly the person leans to this tag, built from their ranks by a nightly job. */
  affinity: number;
}
