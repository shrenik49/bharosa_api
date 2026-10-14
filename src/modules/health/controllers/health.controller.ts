import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../../common/decorators/public.decorator';
import { DatabaseService } from '../../../database/services/database.service';

@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async check(): Promise<{ status: 'ok'; db: 'up' }> {
    await this.db.query('select 1');
    return { status: 'ok', db: 'up' };
  }
}
