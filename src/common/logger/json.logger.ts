import { LoggerService } from '@nestjs/common';

/** Single-line JSON logs for production (easy to ship to any log service); Nest's pretty logger otherwise. */
export class JsonLogger implements LoggerService {
  private write(level: string, message: unknown, context?: string): void {
    const entry = typeof message === 'object' && message !== null ? message : { message };
    process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), level, context, ...entry })}\n`);
  }

  log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }

  error(message: unknown, ...rest: unknown[]): void {
    const last = rest[rest.length - 1];
    this.write('error', message, typeof last === 'string' ? last : undefined);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }
}
