import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/services/database.service';
import { AreaDto, CityDto, TagDto } from '../dto/reference.dto';

@Injectable()
export class ReferenceService {
  constructor(private readonly db: DatabaseService) {}

  cities(): Promise<CityDto[]> {
    return this.db.query<CityDto>(
      `select id, slug, name, center_lat as "centerLat", center_lng as "centerLng"
         from cities where is_active order by name`,
    );
  }

  areas(citySlug: string): Promise<AreaDto[]> {
    return this.db.query<AreaDto>(
      `select a.id, a.slug, a.name from areas a join cities c on c.id = a.city_id
        where c.slug = $1 order by a.name`,
      [citySlug],
    );
  }

  tags(kinds?: string): Promise<TagDto[]> {
    return this.db.query<TagDto>(
      `select id, kind, slug, name, sort from tags
        where is_active and ($1::text[] is null or kind = any($1))
        order by sort, name`,
      [kinds ? kinds.split(',') : null],
    );
  }
}
