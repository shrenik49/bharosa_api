import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { static as serveStatic } from 'express';
import type { Server } from 'http';
import { resolve } from 'path';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { JsonLogger } from './common/logger/json.logger';
import { requestId } from './common/middleware/request-id.middleware';
import { setupSwagger } from './config/swagger.config';
import { EnvVars } from './config/env.config';

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Cross-cutting HTTP setup shared by main.ts and the e2e tests, so tests run exactly like production:
 * request ids, security headers, strict CORS allowlist, and global request validation.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<EnvVars, true>>(ConfigService);
  app.use(requestId);
  app.use(helmet());
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }), // [] = no browser origin is allowed
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    maxAge: 600,
  });
  // Uploaded photos (public, like place photos in the app). Replaced by a CDN/bucket URL via MEDIA_BASE_URL later.
  app.use(
    '/media',
    serveStatic(resolve(config.get('UPLOAD_DIR', { infer: true })), {
      index: false,
      maxAge: '7d',
      setHeaders: res => {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    }),
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
}

async function bootstrap(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, { logger: isProduction ? new JsonLogger() : undefined });
  configureApp(app);

  const config = app.get<ConfigService<EnvVars, true>>(ConfigService);
  if (config.get('SWAGGER_ENABLED', { infer: true })) setupSwagger(app);

  const server = app.getHttpServer() as Server;
  server.requestTimeout = REQUEST_TIMEOUT_MS;
  server.headersTimeout = REQUEST_TIMEOUT_MS + 5_000;

  app.enableShutdownHooks(); // SIGTERM: stop accepting requests, finish in-flight ones, close the DB pool
  await app.listen(config.get('PORT', { infer: true }), '0.0.0.0');
}

if (require.main === module) {
  void bootstrap();
}
