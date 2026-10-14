import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvVars } from '../../../config/env.config';
import { DatabaseService } from '../../../database/services/database.service';
import { PhotoDto, RegisterPhotoDto } from '../dto/photos.dto';

type PhotoRow = Omit<PhotoDto, 'url' | 'thumbUrl'>;

const PHOTO = `f.id, f.place_id as "placeId", f.visit_id as "visitId", f.user_id as "userId",
  f.storage_path as "storagePath", f.thumb_path as "thumbPath", f.width, f.height, f.blurhash,
  f.like_count as "likeCount", f.created_at as "createdAt",
  exists (select 1 from reactions x where x.user_id = $1 and x.subject_type = 'photo'
           and x.subject_id = f.id and x.kind = 'like') as "likedByMe"`;

/**
 * Photo records. The image bytes are uploaded straight to object storage (provider not chosen yet);
 * this API only registers the file after upload and checks that it belongs to a verified visit of the caller.
 */
@Injectable()
export class PhotosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  async register(userId: string, dto: RegisterPhotoDto): Promise<PhotoDto> {
    // Files live in the uploader's own folder, so nobody can claim someone else's file.
    for (const path of [dto.storagePath, dto.thumbPath]) {
      if (path && !path.startsWith(`${userId}/`)) {
        throw new BadRequestException('Photo files must be stored under your own folder.');
      }
    }
    const visit = await this.db.queryOne<{ place_id: string }>(
      `select place_id from visits where id = $1 and user_id = $2 and status = 'verified'`,
      [dto.visitId, userId],
    );
    if (!visit) throw new ForbiddenException('Visit not found or not verified');

    // The max-3-per-visit rule and the verified-visit rule are also enforced by a database trigger.
    const row = await this.db.queryOne<{ id: string }>(
      `insert into photos(user_id, place_id, visit_id, storage_path, thumb_path, width, height, bytes, blurhash)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [
        userId,
        visit.place_id,
        dto.visitId,
        dto.storagePath,
        dto.thumbPath ?? null,
        dto.width ?? null,
        dto.height ?? null,
        dto.bytes ?? null,
        dto.blurhash ?? null,
      ],
    );
    const photos = await this.query(userId, 'f.id = $2', [(row as { id: string }).id]);
    return photos[0];
  }

  forPlace(
    viewerId: string,
    placeId: string,
    sort: 'top' | 'recent',
    limit: number,
    offset: number,
  ): Promise<PhotoDto[]> {
    const order = sort === 'top' ? 'f.like_count desc, f.created_at desc' : 'f.created_at desc';
    return this.query(viewerId, `f.place_id = $2 and f.status = 'approved'`, [placeId], order, limit, offset);
  }

  mine(userId: string, limit: number, offset: number): Promise<PhotoDto[]> {
    return this.query(userId, 'f.user_id = $1', [], 'f.created_at desc', limit, offset);
  }

  async remove(userId: string, photoId: string): Promise<void> {
    const deleted = await this.db.queryOne('delete from photos where id = $1 and user_id = $2 returning id', [
      photoId,
      userId,
    ]);
    if (!deleted) throw new NotFoundException('Photo not found');
  }

  /** `where` may only reference $1 (viewer) and the extra params starting at $2; it is a fixed string, never client input. */
  private async query(
    viewerId: string,
    where: string,
    extra: unknown[],
    order = 'f.created_at desc',
    limit = 50,
    offset = 0,
  ): Promise<PhotoDto[]> {
    const rows = await this.db.query<PhotoRow>(
      `select ${PHOTO} from photos f where ${where} order by ${order} limit ${Number(limit)} offset ${Number(offset)}`,
      [viewerId, ...extra],
    );
    const base = this.config.get('MEDIA_BASE_URL', { infer: true });
    const toUrl = (path: string | null): string | null => (path && base ? `${base}/${path}` : null);
    return rows.map(row => ({ ...row, url: toUrl(row.storagePath), thumbUrl: toUrl(row.thumbPath) }));
  }
}
