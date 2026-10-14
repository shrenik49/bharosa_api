import { IsOptional, IsString, Matches } from 'class-validator';

export class TagsQueryDto {
  /** Comma separated tag kinds, e.g. `food,cuisine,format`. Omit for every kind. */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]+(,[a-z]+)*$/)
  kinds?: string;
}

export class CityDto {
  id: number;
  slug: string;
  name: string;
  centerLat: number;
  centerLng: number;
}

export class AreaDto {
  id: number;
  slug: string;
  name: string;
}

export class TagDto {
  id: number;
  kind: string;
  slug: string;
  name: string;
  sort: number;
}
