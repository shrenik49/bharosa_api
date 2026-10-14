import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class CreateListDto {
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  name: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateListDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class AddListItemDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class ListSummaryDto {
  id: string;
  name: string;
  /** `want` (Want to try), `favorites`, or `custom`. */
  kind: string;
  isPublic: boolean;
  likeCount: number;
  itemCount: number;
}

export class ListItemDto {
  placeId: string;
  name: string;
  area: string | null;
  note: string | null;
  addedAt: Date;
}

export class ListDetailDto extends ListSummaryDto {
  ownerId: string;
  items: ListItemDto[];
}

export class BeenThereDto {
  placeId: string;
  name: string;
  area: string | null;
  visits: number;
  lastVisit: Date;
}
