import { Injectable, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { DatabaseService } from '../../../database/services/database.service';
import { BCRYPT_COST } from '../../auth/services/auth.service';
import { TokensService } from '../../auth/services/tokens.service';

@Injectable()
export class AccountService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tokens: TokensService,
  ) {}

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    await this.assertPassword(userId, currentPassword);
    await this.db.query('update users set password_hash = $2 where id = $1', [
      userId,
      await hash(newPassword, BCRYPT_COST),
    ]);
    // Signs out every device, including this one: the app logs in again with the new password.
    await this.tokens.revokeAll(userId);
  }

  /**
   * Soft delete: the profile disappears from search, feeds and login immediately; a later job can purge it.
   * Visits and ranks stay so other people's place scores do not shift.
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    await this.assertPassword(userId, password);
    await this.db.query('update profiles set deleted_at = now() where id = $1', [userId]);
    await this.tokens.revokeAll(userId);
  }

  private async assertPassword(userId: string, password: string): Promise<void> {
    const row = await this.db.queryOne<{ password_hash: string }>('select password_hash from users where id = $1', [
      userId,
    ]);
    if (!row || !(await compare(password, row.password_hash))) {
      throw new UnauthorizedException('Incorrect password.');
    }
  }
}
