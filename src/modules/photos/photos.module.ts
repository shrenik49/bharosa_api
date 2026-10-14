import { Module } from '@nestjs/common';
import { PhotosController } from './controllers/photos.controller';
import { PhotosService } from './services/photos.service';
import { StorageService } from './services/storage.service';

@Module({ controllers: [PhotosController], providers: [PhotosService, StorageService] })
export class PhotosModule {}
