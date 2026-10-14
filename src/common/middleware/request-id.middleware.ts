import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    /** Correlation id, also returned to the client as the x-request-id header. */
    id?: string;
  }
}

/** Gives every request an id (or keeps a sane one sent by a proxy) before anything else runs. */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  req.id = typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
}
