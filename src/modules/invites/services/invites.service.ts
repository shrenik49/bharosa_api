import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { DatabaseService } from '../../../database/services/database.service';
import { CreateInviteDto, InviteDto } from '../dto/invites.dto';

// No 0/O/1/I: codes are read aloud and typed by hand.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export function makeInviteCode(): string {
  return Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}

const INVITE = `code, max_uses as "maxUses", uses, expires_at as "expiresAt", created_at as "createdAt"`;

/** "Copy your invite link". Contacts are never uploaded; a code is just a shareable string. */
@Injectable()
export class InvitesService {
  constructor(private readonly db: DatabaseService) {}

  async create(userId: string, { maxUses = 25, expiresInDays }: CreateInviteDto): Promise<InviteDto> {
    const row = await this.db.queryOne<InviteDto>(
      `insert into invites(code, inviter_id, max_uses, expires_at)
       values ($1, $2, $3, case when $4::int is null then null else now() + make_interval(days => $4::int) end)
       returning ${INVITE}`,
      [makeInviteCode(), userId, maxUses, expiresInDays ?? null],
    );
    return row as InviteDto;
  }

  mine(userId: string): Promise<InviteDto[]> {
    return this.db.query<InviteDto>(`select ${INVITE} from invites where inviter_id = $1 order by created_at desc`, [
      userId,
    ]);
  }

  /** Counts one use and tells the inviter. Each person can redeem a code once, and never their own. */
  async redeem(userId: string, code: string): Promise<void> {
    await this.db.transaction(async tx => {
      const invite = await tx.queryOne<{
        inviter_id: string;
        max_uses: number;
        uses: number;
        expired: boolean;
      }>(
        `select inviter_id, max_uses, uses, coalesce(expires_at < now(), false) as expired
           from invites where code = $1 for update`,
        [code],
      );
      if (!invite) throw new NotFoundException('Invite code not found');
      if (invite.inviter_id === userId) throw new BadRequestException('You cannot use your own invite.');
      if (invite.expired) throw new UnprocessableEntityException('This invite has expired.');
      if (invite.uses >= invite.max_uses) throw new UnprocessableEntityException('This invite has been fully used.');

      const redeemed = await tx.queryOne(
        `insert into invite_redemptions(code, user_id) values ($1, $2) on conflict do nothing returning code`,
        [code, userId],
      );
      if (!redeemed) throw new ConflictException('You already used this invite.');

      await tx.query('update invites set uses = uses + 1 where code = $1', [code]);
      await tx.query(
        `insert into notifications(user_id, type, actor_id, subject_type, subject_id)
         values ($1, 'invite_redeemed', $2, 'user', $2)`,
        [invite.inviter_id, userId],
      );
    });
  }
}
