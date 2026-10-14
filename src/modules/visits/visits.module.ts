import { Module } from '@nestjs/common';
import { BadgesModule } from '../badges/badges.module';
import { VisitsController } from './controllers/visits.controller';
import { VisitsService } from './services/visits.service';

@Module({ imports: [BadgesModule], controllers: [VisitsController], providers: [VisitsService] })
export class VisitsModule {}
