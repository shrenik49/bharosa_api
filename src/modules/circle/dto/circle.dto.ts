import { IsIn, IsOptional, IsUUID } from 'class-validator';

export const CIRCLE_RELATIONS = ['friend', 'creator', 'twin'] as const;
export type CircleRelation = (typeof CIRCLE_RELATIONS)[number];

export class AddToCircleDto {
  @IsUUID()
  memberId: string;

  /** Defaults to `friend`. Friends count most in the feed, creators less. */
  @IsOptional()
  @IsIn(CIRCLE_RELATIONS)
  relation?: CircleRelation;
}

export class CircleMemberDto {
  userId: string;
  handle: string;
  displayName: string;
  avatarPath: string | null;
  relation: CircleRelation;
  addedAt: Date;
}

export class TasteTwinDto {
  userId: string;
  handle: string;
  displayName: string;
  avatarPath: string | null;
  /** 0-1: how closely their scores match yours on places you both ranked. */
  score: number;
  /** How many places you both ranked. */
  overlap: number;
}
