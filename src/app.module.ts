import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { validateEnv } from './config/env.config';
import { DatabaseModule } from './database/database.module';
import { FeedModule } from './modules/feed/feed.module';
import { HealthModule } from './modules/health/health.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { PlacesModule } from './modules/places/places.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { RankingsModule } from './modules/rankings/rankings.module';
import { ReferenceModule } from './modules/reference/reference.module';
import { VisitsModule } from './modules/visits/visits.module';
import { AccountModule } from './modules/account/account.module';
import { BadgesModule } from './modules/badges/badges.module';
import { CircleModule } from './modules/circle/circle.module';
import { CreatorsModule } from './modules/creators/creators.module';
import { InvitesModule } from './modules/invites/invites.module';
import { ListsModule } from './modules/lists/lists.module';
import { MailModule } from './modules/mail/mail.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PhotosModule } from './modules/photos/photos.module';
import { ReactionsModule } from './modules/reactions/reactions.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SettingsModule } from './modules/settings/settings.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    ReferenceModule,
    ProfilesModule,
    PlacesModule,
    OnboardingModule,
    VisitsModule,
    RankingsModule,
    FeedModule,
    HealthModule,
    JobsModule,
    MailModule,
    AccountModule,
    SettingsModule,
    ListsModule,
    CircleModule,
    ReviewsModule,
    ReactionsModule,
    NotificationsModule,
    PhotosModule,
    ReportsModule,
    InvitesModule,
    BadgesModule,
    UsersModule,
    CreatorsModule,
  ],
  providers: [
    // Applied to every route of every module, current and future.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class AppModule {}
