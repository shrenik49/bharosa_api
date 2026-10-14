import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { todayInIndia } from '../../../common/utils/time';
import { DatabaseService } from '../../../database/services/database.service';
import { VisitsService } from './visits.service';
import { BadgesService } from '../../badges/services/badges.service';

const place = { lat: 18.5206, lng: 73.8412 };

const badges = { evaluate: jest.fn().mockResolvedValue([]) } as unknown as BadgesService;

function serviceWith(queryOne: jest.Mock): VisitsService {
  return new VisitsService({ queryOne } as unknown as DatabaseService, badges);
}

describe('VisitsService', () => {
  describe('checkIn', () => {
    it('rejects an unknown place', async () => {
      const service = serviceWith(jest.fn().mockResolvedValueOnce(null));
      await expect(service.checkIn('u', 'p', 18.5, 73.8)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a check-in more than 100 m away, without writing a visit', async () => {
      const queryOne = jest.fn().mockResolvedValueOnce(place);
      await expect(serviceWith(queryOne).checkIn('u', 'p', 18.6, 73.9)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(queryOne).toHaveBeenCalledTimes(1);
    });

    it('verifies a check-in at the place and records the distance', async () => {
      const row = {
        id: 'v',
        place_id: 'p',
        method: 'checkin',
        status: 'verified',
        visited_at: new Date(),
        verified_at: new Date(),
        distance_m: 0,
      };
      const queryOne = jest.fn().mockResolvedValueOnce(place).mockResolvedValueOnce(row);
      const visit = await serviceWith(queryOne).checkIn('u', 'p', place.lat, place.lng);
      expect(visit).toMatchObject({ id: 'v', status: 'verified', distanceM: 0 });
      expect(queryOne.mock.calls[1][1]).toEqual(['u', 'p', 0]);
    });
  });

  describe('verifyBill', () => {
    const daysAgo = (n: number): string => {
      const date = new Date(`${todayInIndia()}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() - n);
      return date.toISOString().slice(0, 10);
    };

    it('rejects bills older than 3 days and bills dated in the future', async () => {
      const service = serviceWith(jest.fn());
      await expect(service.verifyBill('u', 'p', 'fingerprint1', daysAgo(4), {})).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      await expect(service.verifyBill('u', 'p', 'fingerprint1', daysAgo(-1), {})).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('accepts a bill from three days ago', async () => {
      const row = {
        id: 'v',
        place_id: 'p',
        method: 'bill',
        status: 'verified',
        visited_at: new Date(),
        verified_at: new Date(),
        distance_m: null,
      };
      const queryOne = jest.fn().mockResolvedValueOnce({ '?column?': 1 }).mockResolvedValueOnce(row);
      await expect(serviceWith(queryOne).verifyBill('u', 'p', 'fingerprint1', daysAgo(3), {})).resolves.toMatchObject({
        status: 'verified',
      });
    });

    it('turns a reused bill fingerprint into a 409', async () => {
      const queryOne = jest
        .fn()
        .mockResolvedValueOnce({ '?column?': 1 })
        .mockRejectedValueOnce({ code: '23505', constraint: 'visits_fingerprint_uq' });
      const attempt = serviceWith(queryOne).verifyBill('u', 'p', 'fingerprint1', daysAgo(0), {});
      await expect(attempt).rejects.toBeInstanceOf(ConflictException);
      await expect(attempt).rejects.toThrow('already been used');
    });
  });
});
