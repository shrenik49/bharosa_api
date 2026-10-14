import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ListPlacesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  city: string = 'pune';

  /** Case-insensitive name search. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;
}

export class PlaceSummaryDto {
  id: string;
  name: string;
  slug: string;
  area: string | null;
  lat: number;
  lng: number;
  priceLevel: number | null;
}

export class PlaceTagDto {
  id: number;
  kind: string;
  slug: string;
  name: string;
}

export class PlaceStatsDto {
  verifiedVisits: number;
  uniqueVisitors: number;
  repeatVisitors: number;
  reviewCount: number;
  photoCount: number;
}

export class PlaceDishDto {
  id: string;
  name: string;
}

export class PlaceDetailDto extends PlaceSummaryDto {
  address: string | null;
  tags: PlaceTagDto[];
  /** Dishes people have logged at this place; the menu builds itself from visits. */
  dishes: PlaceDishDto[];
  stats: PlaceStatsDto;
}
