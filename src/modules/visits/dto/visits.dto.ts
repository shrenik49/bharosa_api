import { IsLatitude, IsLongitude, IsObject, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class CheckInDto {
  @IsUUID()
  placeId: string;

  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;
}

export class BillDto {
  @IsUUID()
  placeId: string;

  /** Hash of the bill's date, total and place, computed on the phone. The bill image is never uploaded. */
  @IsString()
  @Length(8, 128)
  fingerprint: string;

  /** The date printed on the bill, YYYY-MM-DD (India time). */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'billDate must be YYYY-MM-DD' })
  billDate: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}

export class VisitResponseDto {
  id: string;
  placeId: string;
  method: string;
  status: string;
  visitedAt: Date;
  verifiedAt: Date | null;
  distanceM: number | null;
}

export class VisitWithPlaceDto extends VisitResponseDto {
  placeName: string;
  area: string | null;
}
