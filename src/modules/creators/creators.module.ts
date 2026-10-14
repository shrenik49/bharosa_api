import { Module } from '@nestjs/common';
import { CreatorsController } from './controllers/creators.controller';
import { CreatorsService } from './services/creators.service';

@Module({ controllers: [CreatorsController], providers: [CreatorsService] })
export class CreatorsModule {}
