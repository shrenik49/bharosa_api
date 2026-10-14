import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/interfaces/auth.interface';
import { AddToCircleDto, CircleMemberDto, TasteTwinDto } from '../dto/circle.dto';
import { CircleService } from '../services/circle.service';

@ApiTags('circle')
@ApiBearerAuth()
@Controller('circle')
export class CircleController {
  constructor(private readonly circle: CircleService) {}

  @Get()
  @ApiOkResponse({ type: [CircleMemberDto], description: 'People I trust' })
  mine(@CurrentUser() user: AuthUser): Promise<CircleMemberDto[]> {
    return this.circle.mine(user.id);
  }

  @Get('added-me')
  @ApiOkResponse({ type: [CircleMemberDto], description: 'People who trust me' })
  addedMe(@CurrentUser() user: AuthUser): Promise<CircleMemberDto[]> {
    return this.circle.addedMe(user.id);
  }

  @Get('twins')
  @ApiOkResponse({ type: [TasteTwinDto] })
  twins(@CurrentUser() user: AuthUser): Promise<TasteTwinDto[]> {
    return this.circle.twins(user.id);
  }

  @HttpCode(204)
  @Post()
  @ApiNoContentResponse()
  async add(@CurrentUser() user: AuthUser, @Body() dto: AddToCircleDto): Promise<void> {
    await this.circle.add(user.id, dto.memberId, dto.relation);
  }

  @HttpCode(204)
  @Delete(':memberId')
  @ApiNoContentResponse()
  async remove(@CurrentUser() user: AuthUser, @Param('memberId', ParseUUIDPipe) memberId: string): Promise<void> {
    await this.circle.remove(user.id, memberId);
  }
}
