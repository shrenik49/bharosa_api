import { makeHandle } from './auth.service';

describe('makeHandle', () => {
  const id = 'abcde123-0000-0000-0000-000000000000';

  it('builds a handle from the email and the start of the user id', () => {
    expect(makeHandle('Shrenik.Sutar@gmail.com', id)).toBe('shreniksutarabcde');
  });

  it('always satisfies the profiles.handle constraint (3-24 of a-z, 0-9, _)', () => {
    for (const email of ['a@x.com', '!!!@x.com', 'very.long.name.that.goes.on.and.on@x.com']) {
      expect(makeHandle(email, id)).toMatch(/^[a-z0-9_]{3,24}$/);
    }
  });
});
