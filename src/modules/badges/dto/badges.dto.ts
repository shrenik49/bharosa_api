export class BadgeDto {
  code: string;
  name: string;
  description: string;
  /** When the signed-in user earned it, or null if not yet. */
  awardedAt: Date | null;
}
