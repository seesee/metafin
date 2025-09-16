import { Module } from '@nestjs/common';
import { ConfigModule } from '../modules/config/config.module.js';
import { LoggerModule } from '../modules/logger/logger.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { JellyfinModule } from '../jellyfin/jellyfin.module.js';
import { MetadataService } from './metadata.service.js';
import { MetadataController } from './metadata.controller.js';

@Module({
  imports: [ConfigModule, LoggerModule, DatabaseModule, JellyfinModule],
  providers: [MetadataService],
  controllers: [MetadataController],
  exports: [MetadataService],
})
export class MetadataModule {}
