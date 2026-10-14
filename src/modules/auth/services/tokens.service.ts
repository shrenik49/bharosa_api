import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { EnvVars } from '../../../config/env.config';
import { TokenPairDto } from '../dto/auth.dto';
import { DatabaseService, Queryable } from '../../../database/services/database.service';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** Short-lived JWT access tokens plus rotating, hashed-at-rest refresh tokens. */
@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly db: DatabaseService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  async issue(userId: string, tx: Queryable = this.db): Promise<TokenPairDto> {
    const accessToken = await this.jwt.signAsync({ sub: userId });
    const { exp, iat } = this.jwt.decode<{ exp: number; iat: number }>(accessToken);

    const refreshToken = randomBytes(48).toString('base64url');
    const days = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    await tx.query(
      `insert into refresh_tokens(user_id, token_hash, expires_at)
       values ($1, $2, now() + make_interval(days => $3))`,
      [userId, sha256(refreshToken), days],
    );
    return { accessToken, refreshToken, expiresIn: exp - iat };
  }

  /**
   * Exchanges a refresh token for a new pair and revokes the old one.
   * Presenting an already-used token means it leaked, so every session of that user is revoked.
   */
  async rotate(refreshToken: string): Promise<{ userId: string; tokens: TokenPairDto }> {
    const hash = sha256(refreshToken);
    const row = await this.db.queryOne<{ id: string; user_id: string; revoked_at: Date | null; expired: boolean }>(
      'select id, user_id, revoked_at, expires_at < now() as expired from refresh_tokens where token_hash = $1',
      [hash],
    );
    if (!row) throw new UnauthorizedException('Invalid session');
    if (row.revoked_at) {
      await this.revokeAll(row.user_id);
      throw new UnauthorizedException('Invalid session');
    }
    if (row.expired) throw new UnauthorizedException('Your session has expired. Please sign in again.');

    return this.db.transaction(async tx => {
      await tx.query('update refresh_tokens set revoked_at = now() where id = $1', [row.id]);
      return { userId: row.user_id, tokens: await this.issue(row.user_id, tx) };
    });
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.db.query('update refresh_tokens set revoked_at = now() where token_hash = $1 and revoked_at is null', [
      sha256(refreshToken),
    ]);
  }

  async revokeAll(userId: string): Promise<void> {
    await this.db.query('update refresh_tokens set revoked_at = now() where user_id = $1 and revoked_at is null', [
      userId,
    ]);
  }
}
