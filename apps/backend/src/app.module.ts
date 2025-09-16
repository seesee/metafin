import { Module } from '@nestjs/common';
import { ConfigModule } from './modules/config/config.module.js';
import { LoggerModule } from './modules/logger/logger.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { DatabaseModule } from './database/database.module.js';
import { JellyfinModule } from './jellyfin/jellyfin.module.js';
import { LibraryModule } from './library/library.module.js';
import { MetadataModule } from './metadata/metadata.module.js';
import { ProviderModule } from './providers/provider.module.js';
import { AppController } from './app.controller.js';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    DatabaseModule,
    JellyfinModule,
    LibraryModule,
    MetadataModule,
    ProviderModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
