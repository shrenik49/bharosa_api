import { Module } from '@nestjs/common';
import { ReferenceController } from './controllers/reference.controller';
import { ReferenceService } from './services/reference.service';

@Module({ controllers: [ReferenceController], providers: [ReferenceService] })
export class ReferenceModule {}
