import { Transform } from 'class-transformer';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class UpdateCreatorProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  tagline?: string;

  /** For example { "instagram": "https://...", "youtube": "https://..." }. */
  @IsOptional()
  @IsObject()
  links?: Record<string, string>;

  /** How the creator handles free meals and sponsorship. Shown on the transparency screen. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  disclosurePolicy?: string;
}

export class CreatorDto {
  userId: string;
  handle: string;
  displayName: string;
  avatarPath: string | null;
  tagline: string | null;
  links: Record<string, string>;
  disclosurePolicy: string | null;
  /** Set by us after checking the creator; never by the creator. */
  verifiedAt: Date | null;
  verifiedVisits: number;
  /** Percent of verified visits the creator paid for themselves. */
  paidOwnPct: number | null;
  sponsoredFlagged: number;
}
