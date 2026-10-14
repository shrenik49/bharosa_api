import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiErrorDto } from '../dto/api-error.dto';

interface PgError extends Error {
  code?: string;
}

const PG_STATUS: Record<string, [HttpStatus, string]> = {
  '23505': [HttpStatus.CONFLICT, 'That already exists.'],
  '23503': [HttpStatus.BAD_REQUEST, 'A referenced record does not exist.'],
  '23514': [HttpStatus.UNPROCESSABLE_ENTITY, 'That is not allowed.'],
  '22P02': [HttpStatus.BAD_REQUEST, 'Malformed value.'],
};

/**
 * One error shape for the whole API: { statusCode, error, message, path, timestamp, requestId }.
 * Database errors are mapped to friendly statuses; anything unexpected becomes a generic 500 and the
 * details (stack, SQL) are logged on the server only, never sent to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const { statusCode, message } = this.describe(exception);
    const body: ApiErrorDto = {
      statusCode,
      error: HttpStatus[statusCode] ?? 'Error',
      message,
      path: request.path,
      timestamp: new Date().toISOString(),
      requestId: request.id,
    };
    response.status(statusCode).json(body);
  }

  private describe(exception: unknown): { statusCode: number; message: string | string[] } {
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : ((payload as { message?: string | string[] }).message ?? exception.message);
      return { statusCode: exception.getStatus(), message };
    }

    const mapped = (exception as PgError)?.code ? PG_STATUS[(exception as PgError).code as string] : undefined;
    if (mapped) return { statusCode: mapped[0], message: mapped[1] };

    this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Something went wrong on our side.' };
  }
}
