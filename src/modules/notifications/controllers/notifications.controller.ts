import { Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/interfaces/auth.interface';
import { ListNotificationsQueryDto, NotificationDto, UnreadCountDto } from '../dto/notifications.dto';
import { NotificationsService } from '../services/notifications.service';

/** The Activity screen. */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOkResponse({ type: [NotificationDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query() { unreadOnly, limit, offset }: ListNotificationsQueryDto,
  ): Promise<NotificationDto[]> {
    return this.notifications.list(user.id, unreadOnly, limit, offset);
  }

  @Get('unread-count')
  @ApiOkResponse({ type: UnreadCountDto })
  async unreadCount(@CurrentUser() user: AuthUser): Promise<UnreadCountDto> {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  @HttpCode(204)
  @Post('read-all')
  @ApiNoContentResponse()
  async markAllRead(@CurrentUser() user: AuthUser): Promise<void> {
    await this.notifications.markAllRead(user.id);
  }

  @HttpCode(204)
  @Post(':id/read')
  @ApiNoContentResponse()
  async markRead(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.notifications.markRead(user.id, id);
  }
}
