import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/** The phone resizes to about 1080 px WebP (under 300 KB); anything over this is refused. */
export const MAX_PHOTO_BYTES = 512_000;
const PATH_PATTERN = /^[0-9a-f-]{36}\/[\w.-]{1,80}\.(webp|jpe?g)$/;

export class RegisterPhotoDto {
  /** The verified visit the photo belongs to (max 3 photos per visit). */
  @IsUUID()
  visitId: string;

  /** Where the file was uploaded: `{your user id}/{photo id}.webp`. */
  @Matches(PATH_PATTERN, { message: 'storagePath must look like {userId}/{name}.webp' })
  storagePath: string;

  @IsOptional()
  @Matches(PATH_PATTERN, { message: 'thumbPath must look like {userId}/{name}.webp' })
  thumbPath?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8000)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8000)
  height?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PHOTO_BYTES)
  bytes?: number;

  /** Tiny placeholder shown while the image loads. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  blurhash?: string;
}

export class ListPhotosQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value ?? 'top')
  @IsIn(['top', 'recent'])
  sort: 'top' | 'recent' = 'top';
}

export class PhotoDto {
  id: string;
  placeId: string;
  visitId: string;
  userId: string;
  storagePath: string;
  thumbPath: string | null;
  /** Where the file is served: MEDIA_BASE_URL when set, otherwise the API serves it under /media. */
  url: string | null;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  likeCount: number;
  likedByMe: boolean;
  createdAt: Date;
}

/** Fields sent alongside the image file in a multipart upload. */
export class UploadPhotoDto {
  @IsUUID()
  visitId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8000)
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8000)
  height?: number;
}
