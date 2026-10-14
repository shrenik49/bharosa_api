import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { Transform } from 'class-transformer';
import { IsString, IsUUID, Length } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class CreateReviewDto {
  /** The verified visit this review is about. One review per visit. */
  @IsUUID()
  visitId: string;

  @Transform(trim)
  @IsString()
  @Length(1, 500)
  body: string;
}

export class UpdateReviewDto {
  @Transform(trim)
  @IsString()
  @Length(1, 500)
  body: string;
}

export class ReviewDto {
  id: string;
  placeId: string;
  body: string;
  likeCount: number;
  likedByMe: boolean;
  createdAt: Date;
  authorId: string;
  authorName: string;
  authorHandle: string;
}

export class ListReviewsQueryDto extends PaginationQueryDto {
  /** `circle` keeps only reviews by people in my circle. */
  @IsOptional()
  @IsIn(['all', 'circle'])
  filter: 'all' | 'circle' = 'all';
}
