import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { DatabaseService } from '../../../database/services/database.service';
import { AuthResponseDto, LoginDto, SignUpDto, TokenPairDto } from '../dto/auth.dto';
import { TokensService } from './tokens.service';

export const BCRYPT_COST = 12;

/** Port of the old handle_new_user() trigger: a readable, unique handle from the email. */
export function makeHandle(email: string, userId: string): string {
  let base = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  if (base.length < 3) base += 'user';
  return base.slice(0, 18) + userId.replace(/-/g, '').slice(0, 5);
}

@Injectable()
export class AuthService {
  // Compared against when the email is unknown, so "no such user" and "wrong password" take equally long.
  private readonly dummyHash: Promise<string> = hash('not-a-real-password', BCRYPT_COST);

  constructor(
    private readonly db: DatabaseService,
    private readonly tokens: TokensService,
  ) {}

  /** Creates the account plus what the old signup trigger created: profile, settings, "Want to try" list. */
  async signUp({ name, email, password }: SignUpDto): Promise<AuthResponseDto> {
    const passwordHash = await hash(password, BCRYPT_COST);
    return this.db.transaction(async tx => {
      const existing = await tx.queryOne('select 1 from users where email = $1', [email]);
      if (existing) throw new ConflictException('An account with this email already exists.');

      const user = await tx.queryOne<{ id: string; email: string }>(
        'insert into users(email, password_hash) values ($1, $2) returning id, email',
        [email, passwordHash],
      );
      if (!user) throw new Error('user insert returned no row');

      await tx.query('insert into profiles(id, handle, display_name) values ($1, $2, $3)', [
        user.id,
        makeHandle(email, user.id),
        name,
      ]);
      await tx.query('insert into user_settings(user_id) values ($1)', [user.id]);
      await tx.query(`insert into lists(user_id, name, kind) values ($1, 'Want to try', 'want')`, [user.id]);

      const pair = await this.tokens.issue(user.id, tx);
      return { ...pair, user: { id: user.id, email: user.email, displayName: name } };
    });
  }

  async login({ email, password }: LoginDto): Promise<AuthResponseDto> {
    const row = await this.db.queryOne<{ id: string; email: string; password_hash: string; display_name: string }>(
      `select u.id, u.email, u.password_hash, p.display_name
         from users u join profiles p on p.id = u.id
        where u.email = $1 and p.deleted_at is null`,
      [email],
    );
    const ok = await compare(password, row?.password_hash ?? (await this.dummyHash));
    if (!row || !ok) throw new UnauthorizedException('Incorrect email or password.');

    const pair = await this.tokens.issue(row.id);
    return { ...pair, user: { id: row.id, email: row.email, displayName: row.display_name } };
  }

  async refresh(refreshToken: string): Promise<TokenPairDto> {
    return (await this.tokens.rotate(refreshToken)).tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }
}
