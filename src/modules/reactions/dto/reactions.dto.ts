export const REACTION_SUBJECTS = ['photo', 'review', 'list'] as const;
export type ReactionSubject = (typeof REACTION_SUBJECTS)[number];
