import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../database/services/database.service';
import { ListPlacesQueryDto, PlaceDetailDto, PlaceStatsDto, PlaceSummaryDto, PlaceTagDto } from '../dto/places.dto';

const SUMMARY_COLUMNS = `p.id, p.name, p.slug, a.name as area, p.lat, p.lng, p.price_level as "priceLevel"`;
const EMPTY_STATS: PlaceStatsDto = {
  verifiedVisits: 0,
  uniqueVisitors: 0,
  repeatVisitors: 0,
  reviewCount: 0,
  photoCount: 0,
};

@Injectable()
export class PlacesService {
  constructor(private readonly db: DatabaseService) {}

  list({ city, q, limit, offset }: ListPlacesQueryDto): Promise<PlaceSummaryDto[]> {
    return this.db.query<PlaceSummaryDto>(
      `select ${SUMMARY_COLUMNS}
         from places p
         join cities c on c.id = p.city_id
         left join areas a on a.id = p.area_id
        where c.slug = $1 and p.status = 'active'
          and ($2::text is null or p.name ilike '%' || $2 || '%')
        order by p.name
        limit $3 offset $4`,
      [city, q?.trim() || null, limit, offset],
    );
  }

  async get(id: string): Promise<PlaceDetailDto> {
    const place = await this.db.queryOne<PlaceSummaryDto & { address: string | null }>(
      `select ${SUMMARY_COLUMNS}, p.address
         from places p left join areas a on a.id = p.area_id
        where p.id = $1 and p.status <> 'hidden'`,
      [id],
    );
    if (!place) throw new NotFoundException('Place not found');

    const tags = await this.db.query<PlaceTagDto>(
      `select t.id, t.kind, t.slug, t.name from place_tags pt join tags t on t.id = pt.tag_id
        where pt.place_id = $1 order by t.sort`,
      [id],
    );
    const stats = await this.db.queryOne<PlaceStatsDto>(
      `select verified_visits as "verifiedVisits", unique_visitors as "uniqueVisitors",
              repeat_visitors as "repeatVisitors", review_count as "reviewCount", photo_count as "photoCount"
         from place_stats where place_id = $1`,
      [id],
    );
    return { ...place, tags, stats: stats ?? EMPTY_STATS };
  }
}
