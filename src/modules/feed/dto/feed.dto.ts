import { IsOptional, IsString, Matches } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class FeedQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  city: string = 'pune';

  /** `all`, `circle`, or a tag slug such as `street-food`, `cafe`, `late-night`. */
  @IsOptional()
  @Matches(/^[a-z0-9-]{1,40}$/)
  filter: string = 'all';
}

export class FeedItemDto {
  placeId: string;
  name: string;
  area: string | null;
  lat: number;
  lng: number;
  /** Trust-weighted score for this viewer, 0-100. */
  match: number;
  verifiedVisits: number;
  /** Percent of visitors who came back on another day. */
  repeatPct: number;
  /** People in the viewer's circle who ranked this place. */
  vouchers: number;
  voucherNames: string[];
}
