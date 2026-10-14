import { validateEnv } from './env.config';

const base = { DATABASE_URL: 'postgres://x', JWT_ACCESS_SECRET: 'a-development-secret' };

describe('validateEnv', () => {
  it('applies safe defaults', () => {
    const env = validateEnv(base);
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGINS).toEqual([]);
    expect(env.SWAGGER_ENABLED).toBe(true);
  });

  it('fails fast when required values are missing', () => {
    expect(() => validateEnv({ JWT_ACCESS_SECRET: 'x' })).toThrow('DATABASE_URL');
    expect(() => validateEnv({ DATABASE_URL: 'x' })).toThrow('JWT_ACCESS_SECRET');
  });

  it('parses the CORS allowlist', () => {
    const env = validateEnv({ ...base, CORS_ORIGINS: 'https://a.com, https://b.com ,' });
    expect(env.CORS_ORIGINS).toEqual(['https://a.com', 'https://b.com']);
  });

  it('rejects weak secrets in production and turns Swagger off by default there', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow('JWT_ACCESS_SECRET');
    const env = validateEnv({ ...base, NODE_ENV: 'production', JWT_ACCESS_SECRET: 'x'.repeat(48) });
    expect(env.SWAGGER_ENABLED).toBe(false);
  });

  it('rejects a non-numeric port', () => {
    expect(() => validateEnv({ ...base, PORT: 'abc' })).toThrow('PORT');
  });
});
