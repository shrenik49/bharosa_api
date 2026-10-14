import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../database/services/database.service';
import { CreateReportDto, ReportDto, ReportSubject } from '../dto/reports.dto';

// The report target must exist; `owner` says whose content it is, so people cannot report themselves.
// $1 = subject id. Fixed strings keyed by a validated enum.
const SUBJECT: Record<ReportSubject, string> = {
  review: `select user_id as owner from reviews where id = $1`,
  photo: `select user_id as owner from photos where id = $1`,
  user: `select id as owner from profiles where id = $1 and deleted_at is null`,
  place: `select null::uuid as owner from places where id = $1`,
};

/**
 * Users can report; upholding or dismissing a report is moderator work and has no endpoint yet
 * (it needs an admin role). Until then reports are stored as `open`.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly db: DatabaseService) {}

  async create(userId: string, dto: CreateReportDto): Promise<ReportDto> {
    const subject = await this.db.queryOne<{ owner: string | null }>(SUBJECT[dto.subjectType], [dto.subjectId]);
    if (!subject) throw new NotFoundException(`${dto.subjectType} not found`);
    if (subject.owner === userId) throw new BadRequestException('You cannot report your own content.');

    try {
      const row = await this.db.queryOne<ReportDto>(
        `insert into reports(reporter_id, subject_type, subject_id, reason, details) values ($1, $2, $3, $4, $5)
         returning id, subject_type as "subjectType", subject_id as "subjectId", reason, status, created_at as "createdAt"`,
        [userId, dto.subjectType, dto.subjectId, dto.reason, dto.details ?? null],
      );
      return row as ReportDto;
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('You already reported this.');
      throw error;
    }
  }

  mine(userId: string): Promise<ReportDto[]> {
    return this.db.query<ReportDto>(
      `select id, subject_type as "subjectType", subject_id as "subjectId", reason, status, created_at as "createdAt"
         from reports where reporter_id = $1 order by created_at desc`,
      [userId],
    );
  }
}
