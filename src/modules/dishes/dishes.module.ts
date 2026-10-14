import { Module } from '@nestjs/common';
import { DishesController } from './controllers/dishes.controller';
import { DishesService } from './services/dishes.service';

@Module({ controllers: [DishesController], providers: [DishesService] })
export class DishesModule {}
