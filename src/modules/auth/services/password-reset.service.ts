import { BadRequestException, Injectable } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { DatabaseService } from '../../../database/services/database.service';
import { MailService } from '../../mail/services/mail.service';
import { BCRYPT_COST } from './auth.service';

const RESET_TOKEN_TTL_MINUTES = 60;

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
  ) {}

  /** Always completes the same way, so the response never reveals whether an email has an account. */
  async request(email: string): Promise<void> {
    const user = await this.db.queryOne<{ id: string; email: string }>(
      `select u.id, u.email from users u join profiles p on p.id = u.id
        where u.email = $1 and p.deleted_at is null`,
      [email],
    );
    if (!user) return;

    const token = randomBytes(32).toString('base64url');
    await this.db.query(
      `insert into password_reset_tokens(user_id, token_hash, expires_at)
       values ($1, $2, now() + make_interval(mins => $3))`,
      [user.id, sha256(token), RESET_TOKEN_TTL_MINUTES],
    );
    try {
      await this.mail.send({
        to: user.email,
        subject: 'Reset your Bharosa password',
        text: `Use this code in the app to choose a new password (valid for ${RESET_TOKEN_TTL_MINUTES} minutes):\n\n${token}\n\nIf you did not ask for this, ignore this email.`,
      });
    } catch {
      // Delivery problems must not change the response (no account enumeration).
    }
  }

  async reset(token: string, newPassword: string): Promise<void> {
    const passwordHash = await hash(newPassword, BCRYPT_COST);
    await this.db.transaction(async tx => {
      const row = await tx.queryOne<{ id: string; user_id: string }>(
        `update password_reset_tokens set used_at = now()
          where token_hash = $1 and used_at is null and expires_at > now()
          returning id, user_id`,
        [sha256(token)],
      );
      if (!row) throw new BadRequestException('This reset code is invalid or has expired.');
      await tx.query('update users set password_hash = $2 where id = $1', [row.user_id, passwordHash]);
      // Everyone signed in with the old password is signed out.
      await tx.query('update refresh_tokens set revoked_at = now() where user_id = $1 and revoked_at is null', [
        row.user_id,
      ]);
    });
  }
}
