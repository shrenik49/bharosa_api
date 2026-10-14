import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common/decorators/public.decorator';
import { ForgotPasswordDto, ResetPasswordDto } from '../dto/password.dto';
import { PasswordResetService } from '../services/password-reset.service';

const STRICT = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('auth')
@Public()
@Controller('auth')
export class PasswordController {
  constructor(private readonly passwordReset: PasswordResetService) {}

  /** Emails a reset code. Always answers 204, whether or not the email has an account. */
  @Throttle(STRICT)
  @HttpCode(204)
  @Post('forgot-password')
  @ApiNoContentResponse()
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.passwordReset.request(dto.email);
  }

  @Throttle(STRICT)
  @HttpCode(204)
  @Post('reset-password')
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'Code invalid, used or expired' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.passwordReset.reset(dto.token, dto.newPassword);
  }
}
