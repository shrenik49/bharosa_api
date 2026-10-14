import { DatabaseService } from '../../../database/services/database.service';
import { BadgesService } from './badges.service';

describe('BadgesService.evaluate', () => {
  it('awards only badges whose rule is met, and notifies once per award', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        { code: 'regular', rule: { revisits: 3 } },
        { code: 'honest', rule: { verified: 30, flags: 0 } },
        { code: 'mystery', rule: {} },
      ])
      .mockResolvedValue([]);
    const queryOne = jest
      .fn()
      .mockResolvedValueOnce({ '?column?': 1 }) // regular: met
      .mockResolvedValueOnce({ badge_code: 'regular' }) // insert user_badges
      .mockResolvedValueOnce(null); // honest: not met
    const service = new BadgesService({ query, queryOne } as unknown as DatabaseService);

    await expect(service.evaluate('u')).resolves.toEqual(['regular']);
    const notifications = query.mock.calls.filter(([sql]) => String(sql).includes('badge_awarded'));
    expect(notifications).toHaveLength(1);
  });

  it('never throws, so a badge problem cannot break a visit or a ranking', async () => {
    const query = jest.fn().mockRejectedValue(new Error('db down'));
    const service = new BadgesService({ query } as unknown as DatabaseService);
    await expect(service.evaluate('u')).resolves.toEqual([]);
  });
});
