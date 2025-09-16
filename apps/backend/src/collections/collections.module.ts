import { Module } from '@nestjs/common';
import { CollectionsController } from './collections.controller.js';
import { CollectionsService } from './collections.service.js';
import { DatabaseModule } from '../database/database.module.js';
import { JellyfinModule } from '../jellyfin/jellyfin.module.js';

@Module({
  imports: [DatabaseModule, JellyfinModule],
  controllers: [CollectionsController],
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
