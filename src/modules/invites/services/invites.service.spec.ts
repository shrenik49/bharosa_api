import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DatabaseService, Queryable } from '../../../database/services/database.service';
import { InvitesService, makeInviteCode } from './invites.service';

type Invite = { inviter_id: string; max_uses: number; uses: number; expired: boolean } | null;

function serviceWith(invite: Invite, redeemed: unknown = { code: 'X' }) {
  const queryOne = jest.fn().mockResolvedValueOnce(invite).mockResolvedValueOnce(redeemed);
  const query = jest.fn().mockResolvedValue([]);
  const tx = { queryOne, query } as unknown as Queryable;
  const db = { transaction: async <T>(work: (t: Queryable) => Promise<T>) => work(tx) } as unknown as DatabaseService;
  return { service: new InvitesService(db), query };
}

describe('makeInviteCode', () => {
  it('makes 8 readable characters without look-alikes', () => {
    for (let i = 0; i < 200; i++) expect(makeInviteCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });
});

describe('InvitesService.redeem', () => {
  const open = { inviter_id: 'inviter', max_uses: 2, uses: 0, expired: false };

  it('rejects unknown, own, expired and used-up codes', async () => {
    await expect(serviceWith(null).service.redeem('me', 'ABCDEFGH')).rejects.toBeInstanceOf(NotFoundException);
    await expect(serviceWith({ ...open, inviter_id: 'me' }).service.redeem('me', 'ABCDEFGH')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(serviceWith({ ...open, expired: true }).service.redeem('me', 'ABCDEFGH')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    await expect(serviceWith({ ...open, uses: 2 }).service.redeem('me', 'ABCDEFGH')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('rejects a second redemption by the same person', async () => {
    await expect(serviceWith(open, null).service.redeem('me', 'ABCDEFGH')).rejects.toBeInstanceOf(ConflictException);
  });

  it('counts the use and notifies the inviter', async () => {
    const { service, query } = serviceWith(open);
    await service.redeem('me', 'ABCDEFGH');
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toContain('uses = uses + 1');
    expect(query.mock.calls[1][1]).toEqual(['inviter', 'me']);
  });
});
