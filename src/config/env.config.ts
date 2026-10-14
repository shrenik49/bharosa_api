export interface EnvVars {
  PORT: number;
  NODE_ENV: string;
  DATABASE_URL: string;
  DATABASE_SSL: boolean;
  JWT_ACCESS_SECRET: string;
  ACCESS_TOKEN_TTL: string;
  REFRESH_TOKEN_TTL_DAYS: number;
  /** Browser origins allowed by CORS. Empty (the default) disables CORS; the mobile app does not need it. */
  CORS_ORIGINS: string[];
  SWAGGER_ENABLED: boolean;
  ENABLE_JOBS: boolean;
  /** Public base URL where uploaded photos are served from (CDN or bucket). Empty until storage is chosen. */
  MEDIA_BASE_URL: string;
}

function required(env: Record<string, unknown>, key: string): string {
  const value = env[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing environment variable ${key} (see .env.example)`);
  }
  return value;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'string' ? value.toLowerCase() === 'true' : fallback;
}

function positiveInt(value: unknown, fallback: number, key: string): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${key} must be a positive integer`);
  return parsed;
}

/** Validates process.env once at startup so a bad config fails fast, not on the first request. */
export function validateEnv(env: Record<string, unknown>): EnvVars {
  const nodeEnv = typeof env.NODE_ENV === 'string' ? env.NODE_ENV : 'development';
  const isProduction = nodeEnv === 'production';
  const secret = required(env, 'JWT_ACCESS_SECRET');
  if (isProduction && (secret.length < 32 || secret.startsWith('change-me'))) {
    throw new Error('JWT_ACCESS_SECRET must be a long random string in production');
  }
  const origins = typeof env.CORS_ORIGINS === 'string' ? env.CORS_ORIGINS.split(',') : [];
  return {
    PORT: positiveInt(env.PORT, 3000, 'PORT'),
    NODE_ENV: nodeEnv,
    DATABASE_URL: required(env, 'DATABASE_URL'),
    DATABASE_SSL: bool(env.DATABASE_SSL, false),
    JWT_ACCESS_SECRET: secret,
    ACCESS_TOKEN_TTL: typeof env.ACCESS_TOKEN_TTL === 'string' ? env.ACCESS_TOKEN_TTL : '15m',
    REFRESH_TOKEN_TTL_DAYS: positiveInt(env.REFRESH_TOKEN_TTL_DAYS, 30, 'REFRESH_TOKEN_TTL_DAYS'),
    CORS_ORIGINS: origins.map(origin => origin.trim()).filter(Boolean),
    SWAGGER_ENABLED: bool(env.SWAGGER_ENABLED, !isProduction),
    ENABLE_JOBS: bool(env.ENABLE_JOBS, true),
    MEDIA_BASE_URL: typeof env.MEDIA_BASE_URL === 'string' ? env.MEDIA_BASE_URL.trim().replace(/\/+$/, '') : '',
  };
}
