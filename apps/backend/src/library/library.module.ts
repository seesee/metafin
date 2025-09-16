import { Module } from '@nestjs/common';
import { ConfigModule } from '../modules/config/config.module.js';
import { LoggerModule } from '../modules/logger/logger.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { JellyfinModule } from '../jellyfin/jellyfin.module.js';
import { LibrarySyncService } from './library-sync.service.js';
import { LibraryController } from './library.controller.js';

@Module({
  imports: [ConfigModule, LoggerModule, DatabaseModule, JellyfinModule],
  providers: [LibrarySyncService],
  controllers: [LibraryController],
  exports: [LibrarySyncService],
})
export class LibraryModule {}
