import { Module } from '@nestjs/common';
import { ConfigModule } from '../modules/config/config.module.js';
import { LoggerModule } from '../modules/logger/logger.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { JellyfinModule } from '../jellyfin/jellyfin.module.js';
import { ProviderModule } from '../providers/provider.module.js';
import { MetadataService } from './metadata.service.js';
import { MetadataController } from './metadata.controller.js';
import { BulkOperationsService } from './bulk-operations.service.js';
import { BulkOperationsController } from './bulk-operations.controller.js';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    DatabaseModule,
    JellyfinModule,
    ProviderModule,
  ],
  providers: [MetadataService, BulkOperationsService],
  controllers: [MetadataController, BulkOperationsController],
  exports: [MetadataService, BulkOperationsService],
})
export class MetadataModule {}
