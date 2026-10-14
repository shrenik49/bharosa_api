import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../../../common/interfaces/auth.interface';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TasteProfileDto } from '../dto/onboarding.dto';
import { OnboardingService } from '../services/onboarding.service';

@ApiTags('onboarding')
@ApiBearerAuth()
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  /** Saves the taste quiz answers and marks the profile onboarded. Safe to retry. */
  @HttpCode(204)
  @Post('taste-profile')
  @ApiNoContentResponse()
  async saveTasteProfile(@CurrentUser() user: AuthUser, @Body() dto: TasteProfileDto): Promise<void> {
    await this.onboarding.saveTasteProfile(user.id, dto);
  }
}
