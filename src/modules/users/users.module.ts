import { Module } from '@nestjs/common';
import { BadgesModule } from '../badges/badges.module';
import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';

@Module({ imports: [BadgesModule], controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}
