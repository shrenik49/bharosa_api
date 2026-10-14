import { ForbiddenException } from '@nestjs/common';
import { DatabaseService, Queryable } from '../../../database/services/database.service';
import { RankingsService } from './rankings.service';
import { BadgesService } from '../../badges/services/badges.service';

/** A tiny in-memory stand-in for the queries submitComparison makes, so the ordering logic is tested without a database. */
function fakeDb(existing: Record<string, number>, visit: { id: string; place_id: string } | null) {
  const ranks = new Map(Object.entries(existing));
  const tx = {
    query: jest.fn().mockResolvedValue([]),
    queryOne: jest.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('from visits')) return visit;
      if (sql.includes('from places')) return { '?column?': 1 };
      if (sql.includes('select rank_key from user_place_ranks')) {
        const key = ranks.get(params[1] as string);
        return key === undefined ? null : { rank_key: key };
      }
      if (sql.includes('min(rank_key)')) {
        const higher = [...ranks.values()].filter(k => k > (params[1] as number));
        return { k: higher.length ? Math.min(...higher) : null };
      }
      if (sql.includes('max(rank_key)')) {
        const lower = [...ranks.values()].filter(k => k < (params[1] as number));
        return { k: lower.length ? Math.max(...lower) : null };
      }
      if (sql.includes('select score')) return { score: 77 };
      return null;
    }),
  } as unknown as Queryable;
  tx.query = jest.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.startsWith('delete from user_place_ranks')) ranks.delete(params[1] as string);
    if (sql.startsWith('insert into user_place_ranks')) ranks.set(params[1] as string, params[2] as number);
    return [];
  });
  const db = { transaction: async <T>(work: (t: Queryable) => Promise<T>) => work(tx) } as unknown as DatabaseService;
  return {
    service: new RankingsService(db, { evaluate: jest.fn().mockResolvedValue([]) } as unknown as BadgesService),
    ranks,
  };
}

describe('RankingsService.submitComparison', () => {
  const visit = { id: 'v1', place_id: 'new' };

  it('refuses a visit that is not yours or not verified', async () => {
    const { service } = fakeDb({}, null);
    await expect(service.submitComparison('u', 'v1', 'ref', 'better')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('puts a better place just above the reference when nothing is above it', async () => {
    const { service, ranks } = fakeDb({ ref: 0 }, visit);
    await service.submitComparison('u', 'v1', 'ref', 'better');
    expect(ranks.get('new')).toBe(1);
  });

  it('puts a better place halfway between the reference and its upper neighbour', async () => {
    const { service, ranks } = fakeDb({ ref: 0, up: 1 }, visit);
    await service.submitComparison('u', 'v1', 'ref', 'better');
    expect(ranks.get('new')).toBe(0.5);
  });

  it('puts a worse place halfway between the reference and its lower neighbour', async () => {
    const { service, ranks } = fakeDb({ ref: 0, down: -2 }, visit);
    await service.submitComparison('u', 'v1', 'ref', 'worse');
    expect(ranks.get('new')).toBe(-1);
  });

  it('gives "same" the reference position and adds the reference when it was not ranked yet', async () => {
    const { service, ranks } = fakeDb({}, visit);
    const result = await service.submitComparison('u', 'v1', 'ref', 'same');
    expect(ranks.get('ref')).toBe(0);
    expect(ranks.get('new')).toBe(0);
    expect(result).toEqual({ score: 77 });
  });

  it('moves a place that was already ranked instead of duplicating it', async () => {
    const { service, ranks } = fakeDb({ ref: 0, new: 5 }, visit);
    await service.submitComparison('u', 'v1', 'ref', 'worse');
    expect(ranks.get('new')).toBe(-1);
    expect([...ranks.keys()].filter(k => k === 'new')).toHaveLength(1);
  });
});
