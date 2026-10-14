import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/interfaces/auth.interface';
import { CreateInviteDto, InviteDto, RedeemInviteDto } from '../dto/invites.dto';
import { InvitesService } from '../services/invites.service';

@ApiTags('invites')
@ApiBearerAuth()
@Controller('invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Post()
  @ApiCreatedResponse({ type: InviteDto })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInviteDto): Promise<InviteDto> {
    return this.invites.create(user.id, dto);
  }

  @Get('mine')
  @ApiOkResponse({ type: [InviteDto] })
  mine(@CurrentUser() user: AuthUser): Promise<InviteDto[]> {
    return this.invites.mine(user.id);
  }

  @HttpCode(204)
  @Post('redeem')
  @ApiNoContentResponse()
  async redeem(@CurrentUser() user: AuthUser, @Body() dto: RedeemInviteDto): Promise<void> {
    await this.invites.redeem(user.id, dto.code);
  }
}
