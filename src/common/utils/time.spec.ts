import { daysBetween, todayInIndia } from './time';

describe('time helpers', () => {
  it('uses the India date even when UTC is still the previous day', () => {
    // 20:00 UTC on the 14th is 01:30 IST on the 15th.
    expect(todayInIndia(new Date('2026-10-14T20:00:00Z'))).toBe('2026-10-15');
    expect(todayInIndia(new Date('2026-10-14T10:00:00Z'))).toBe('2026-10-14');
  });

  it('counts calendar days between two dates', () => {
    expect(daysBetween('2026-10-15', '2026-10-12')).toBe(3);
    expect(daysBetween('2026-10-15', '2026-10-15')).toBe(0);
    expect(daysBetween('2026-10-15', '2026-10-16')).toBe(-1);
    expect(daysBetween('2026-03-01', '2026-02-28')).toBe(1);
  });
});
