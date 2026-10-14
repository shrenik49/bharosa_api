import { Body, Controller, Delete, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/interfaces/auth.interface';
import { ChangePasswordDto, DeleteAccountDto } from '../dto/account.dto';
import { AccountService } from '../services/account.service';

const STRICT = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('account')
@ApiBearerAuth()
@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Throttle(STRICT)
  @HttpCode(204)
  @Post('change-password')
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: 'Current password is wrong' })
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto): Promise<void> {
    await this.account.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @Throttle(STRICT)
  @HttpCode(204)
  @Delete()
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: 'Password is wrong' })
  async deleteAccount(@CurrentUser() user: AuthUser, @Body() dto: DeleteAccountDto): Promise<void> {
    await this.account.deleteAccount(user.id, dto.password);
  }
}
