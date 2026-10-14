import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { BadgeDto } from '../../badges/dto/badges.dto';

export class SearchUsersQueryDto extends PaginationQueryDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  q: string;
}

export class UserSummaryDto {
  id: string;
  handle: string;
  displayName: string;
  avatarPath: string | null;
  isCreator: boolean;
}

export class PublicProfileDto extends UserSummaryDto {
  bio: string | null;
  verifiedVisits: number;
  placesRevisited: number;
  flags: number;
  /** How I follow this person, if at all. */
  relation: 'friend' | 'creator' | 'twin' | null;
  /** How closely this person's taste matches mine, 0-1, once we have enough places in common. */
  similarityScore: number | null;
  /** How many places we have both ranked. */
  similarityOverlap: number | null;
  badges: BadgeDto[];
}

export class UserRankDto {
  placeId: string;
  name: string;
  score: number;
}
