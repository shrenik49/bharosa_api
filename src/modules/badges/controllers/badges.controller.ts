import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/interfaces/auth.interface';
import { BadgeDto } from '../dto/badges.dto';
import { BadgesService } from '../services/badges.service';

@ApiTags('badges')
@ApiBearerAuth()
@Controller('badges')
export class BadgesController {
  constructor(private readonly badges: BadgesService) {}

  /** Every badge, marking which ones I have earned. */
  @Get()
  @ApiOkResponse({ type: [BadgeDto] })
  catalog(@CurrentUser() user: AuthUser): Promise<BadgeDto[]> {
    return this.badges.catalog(user.id);
  }
}
