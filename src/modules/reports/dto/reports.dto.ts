import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const REPORT_SUBJECTS = ['review', 'photo', 'user', 'place'] as const;
export const REPORT_REASONS = ['paid', 'fake', 'copy', 'abuse', 'other'] as const;
export type ReportSubject = (typeof REPORT_SUBJECTS)[number];
export type ReportReason = (typeof REPORT_REASONS)[number];

export class CreateReportDto {
  @IsIn(REPORT_SUBJECTS)
  subjectType: ReportSubject;

  @IsUUID()
  subjectId: string;

  @IsIn(REPORT_REASONS)
  reason: ReportReason;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  details?: string;
}

export class ReportDto {
  id: number;
  subjectType: ReportSubject;
  subjectId: string;
  reason: ReportReason;
  status: 'open' | 'upheld' | 'dismissed';
  createdAt: Date;
}
