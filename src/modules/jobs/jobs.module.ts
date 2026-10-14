import { Module } from '@nestjs/common';
import { TasteJobs } from './services/taste-jobs.service';

@Module({ providers: [TasteJobs], exports: [TasteJobs] })
export class JobsModule {}
