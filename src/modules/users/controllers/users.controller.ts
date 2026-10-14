import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/interfaces/auth.interface';
import { PublicProfileDto, SearchUsersQueryDto, UserRankDto, UserSummaryDto } from '../dto/users.dto';
import { UsersService } from '../services/users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('search')
  @ApiOkResponse({ type: [UserSummaryDto] })
  search(@Query() { q, limit, offset }: SearchUsersQueryDto): Promise<UserSummaryDto[]> {
    return this.users.search(q, limit, offset);
  }

  @Get(':id')
  @ApiOkResponse({ type: PublicProfileDto })
  @ApiNotFoundResponse()
  profile(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<PublicProfileDto> {
    return this.users.getProfile(user.id, id);
  }

  @Get(':id/ranks')
  @ApiOkResponse({ type: [UserRankDto] })
  @ApiForbiddenResponse({ description: 'This person keeps their ratings private' })
  ranks(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<UserRankDto[]> {
    return this.users.ranks(user.id, id);
  }
}
