import { Module } from '@nestjs/common';
import { OnboardingController } from './controllers/onboarding.controller';
import { OnboardingService } from './services/onboarding.service';

@Module({ controllers: [OnboardingController], providers: [OnboardingService] })
export class OnboardingModule {}
