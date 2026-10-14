import { distanceMeters } from './geo';

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceMeters(18.5206, 73.8412, 18.5206, 73.8412)).toBe(0);
  });

  it('measures roughly 111 m per 0.001 degree of latitude', () => {
    expect(distanceMeters(18.5, 73.8, 18.501, 73.8)).toBeCloseTo(111.2, 0);
  });

  it('puts Vaishali and Roopali (FC Road) about 150 m apart', () => {
    const d = distanceMeters(18.5206, 73.8412, 18.5198, 73.842);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(150);
  });
});
