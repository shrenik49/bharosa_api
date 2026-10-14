import { IsIn, IsUUID } from 'class-validator';

export type ComparisonOutcome = 'better' | 'same' | 'worse';

export class ComparisonDto {
  /** The verified visit the person is rating. */
  @IsUUID()
  visitId: string;

  /** A place they have already ranked. */
  @IsUUID()
  refPlaceId: string;

  @IsIn(['better', 'same', 'worse'])
  outcome: ComparisonOutcome;
}

export class ScoreDto {
  /** 0-100 position in the person's own ranking. */
  score: number;
}

export class RankedPlaceDto {
  placeId: string;
  name: string;
  area: string | null;
  score: number;
}
