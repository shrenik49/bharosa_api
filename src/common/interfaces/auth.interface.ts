import type { Request } from 'express';

export interface AuthUser {
  id: string;
}

export interface AccessTokenPayload {
  sub: string;
}

export type AuthedRequest = Request & { user: AuthUser };
