import { Module } from '@nestjs/common';
import { ProfilesController } from './controllers/profiles.controller';
import { ProfilesService } from './services/profiles.service';

@Module({ controllers: [ProfilesController], providers: [ProfilesService] })
export class ProfilesModule {}
