import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { distanceMeters } from '../../../common/utils/geo';
import { daysBetween, todayInIndia } from '../../../common/utils/time';
import { DatabaseService } from '../../../database/services/database.service';
import { BadgesService } from '../../badges/services/badges.service';
import { VisitResponseDto, VisitWithPlaceDto } from '../dto/visits.dto';

/** A check-in only counts within this distance of the place. */
export const CHECKIN_RADIUS_M = 100;
/** A bill only counts if it is dated today or up to this many days ago. */
export const BILL_MAX_AGE_DAYS = 3;

interface VisitRow {
  id: string;
  place_id: string;
  method: string;
  status: string;
  visited_at: Date;
  verified_at: Date | null;
  distance_m: number | null;
}

const toVisit = (row: VisitRow): VisitResponseDto => ({
  id: row.id,
  placeId: row.place_id,
  method: row.method,
  status: row.status,
  visitedAt: row.visited_at,
  verifiedAt: row.verified_at,
  distanceM: row.distance_m,
});

const VISIT_COLUMNS = 'id, place_id, method, status, visited_at, verified_at, distance_m';

interface PgError {
  code?: string;
  constraint?: string;
}

/**
 * Verification rules (port of verify_checkin / verify_bill). Clients never set status = 'verified';
 * only these methods do, after checking the proof on the server.
 */
@Injectable()
export class VisitsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly badges: BadgesService,
  ) {}

  async checkIn(userId: string, placeId: string, lat: number, lng: number): Promise<VisitResponseDto> {
    const place = await this.db.queryOne<{ lat: number; lng: number }>(
      `select lat, lng from places where id = $1 and status = 'active'`,
      [placeId],
    );
    if (!place) throw new NotFoundException('Unknown place');

    const distance = Math.round(distanceMeters(place.lat, place.lng, lat, lng));
    if (distance > CHECKIN_RADIUS_M) {
      throw new UnprocessableEntityException(`You are too far from the place (${distance} m)`);
    }

    // A second check-in the same day (IST) re-verifies the existing visit instead of failing.
    const row = await this.db.queryOne<VisitRow>(
      `insert into visits(user_id, place_id, method, status, verified_at, distance_m)
       values ($1, $2, 'checkin', 'verified', now(), $3)
       on conflict (user_id, place_id, visit_date)
       do update set status = 'verified', verified_at = coalesce(visits.verified_at, now())
       returning ${VISIT_COLUMNS}`,
      [userId, placeId, distance],
    );
    void this.badges.evaluate(userId);
    return toVisit(row as VisitRow);
  }

  /** The phone reads the bill on-device and sends only a fingerprint; one bill verifies one visit, ever. */
  async verifyBill(
    userId: string,
    placeId: string,
    fingerprint: string,
    billDate: string,
    meta: Record<string, unknown>,
  ): Promise<VisitResponseDto> {
    const age = daysBetween(todayInIndia(), billDate);
    if (age < 0 || age > BILL_MAX_AGE_DAYS) {
      throw new UnprocessableEntityException('This bill is too old (or dated in the future)');
    }
    const place = await this.db.queryOne('select 1 from places where id = $1 and status = $2', [placeId, 'active']);
    if (!place) throw new NotFoundException('Unknown place');

    try {
      const row = await this.db.queryOne<VisitRow>(
        `insert into visits(user_id, place_id, visited_at, method, status, verified_at, proof_fingerprint, proof_meta)
         values ($1, $2, ($3::date)::timestamp at time zone 'Asia/Kolkata', 'bill', 'verified', now(), $4, $5)
         returning ${VISIT_COLUMNS}`,
        [userId, placeId, billDate, fingerprint, meta],
      );
      void this.badges.evaluate(userId);
      return toVisit(row as VisitRow);
    } catch (error) {
      const { code, constraint } = error as PgError;
      if (code === '23505' && constraint === 'visits_fingerprint_uq') {
        throw new ConflictException('This bill has already been used.');
      }
      if (code === '23505') {
        throw new ConflictException('You already have a visit for this place on that day.');
      }
      throw error;
    }
  }

  async listMine(userId: string, limit: number, offset: number): Promise<VisitWithPlaceDto[]> {
    const rows = await this.db.query<VisitRow & { place_name: string }>(
      `select v.id, v.place_id, v.method, v.status, v.visited_at, v.verified_at, v.distance_m, p.name as place_name
         from visits v join places p on p.id = v.place_id
        where v.user_id = $1 and v.status = 'verified'
        order by v.visited_at desc limit $2 offset $3`,
      [userId, limit, offset],
    );
    return rows.map(row => ({ ...toVisit(row), placeName: row.place_name }));
  }
}
