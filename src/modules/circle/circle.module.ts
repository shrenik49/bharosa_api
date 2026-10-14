import { Module } from '@nestjs/common';
import { CircleController } from './controllers/circle.controller';
import { CircleService } from './services/circle.service';

@Module({ controllers: [CircleController], providers: [CircleService] })
export class CircleModule {}
