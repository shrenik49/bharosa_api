import { Module } from '@nestjs/common';
import { ListsController } from './controllers/lists.controller';
import { ListsService } from './services/lists.service';

@Module({ controllers: [ListsController], providers: [ListsService] })
export class ListsModule {}
