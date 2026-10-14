import { Module } from '@nestjs/common';
import { BadgesModule } from '../badges/badges.module';
import { RankingsController } from './controllers/rankings.controller';
import { RankingsService } from './services/rankings.service';

@Module({ imports: [BadgesModule], controllers: [RankingsController], providers: [RankingsService] })
export class RankingsModule {}
