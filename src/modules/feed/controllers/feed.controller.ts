import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../../../common/interfaces/auth.interface';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { FeedItemDto, FeedQueryDto } from '../dto/feed.dto';
import { FeedService } from '../services/feed.service';

@ApiTags('feed')
@ApiBearerAuth()
@Controller('feed')
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get()
  @ApiOkResponse({ type: [FeedItemDto] })
  discover(
    @CurrentUser() user: AuthUser,
    @Query() { city, filter, limit, offset, placeId }: FeedQueryDto,
  ): Promise<FeedItemDto[]> {
    return this.feed.discover(user.id, city, filter, limit, offset, placeId);
  }
}
