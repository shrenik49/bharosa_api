import { Module } from '@nestjs/common';
import { PlacesController } from './controllers/places.controller';
import { PlacesService } from './services/places.service';

@Module({ controllers: [PlacesController], providers: [PlacesService] })
export class PlacesModule {}
