import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';
import type { AuthedRequest } from '../interfaces/auth.interface';

/** One structured log line per request: method, path, status, duration, user. No bodies, no tokens. */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const started = Date.now();
    const http = context.switchToHttp();
    const request = http.getRequest<AuthedRequest>();
    const response = http.getResponse<Response>();
    const log = (): void => {
      this.logger.log({
        requestId: request.id,
        method: request.method,
        path: request.path,
        status: response.statusCode,
        ms: Date.now() - started,
        userId: request.user?.id,
      });
    };
    return next.handle().pipe(tap({ next: log, error: log }));
  }
}
