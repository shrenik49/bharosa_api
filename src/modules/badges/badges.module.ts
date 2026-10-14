import { Module } from '@nestjs/common';
import { BadgesController } from './controllers/badges.controller';
import { BadgesService } from './services/badges.service';

/** Exports BadgesService so visits, rankings and users can award and show badges. */
@Module({ controllers: [BadgesController], providers: [BadgesService], exports: [BadgesService] })
export class BadgesModule {}
