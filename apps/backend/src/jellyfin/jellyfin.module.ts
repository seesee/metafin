import { Module } from '@nestjs/common';
import { ConfigModule } from '../modules/config/config.module.js';
import { LoggerModule } from '../modules/logger/logger.module.js';
import { JellyfinService } from './jellyfin.service.js';

@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [JellyfinService],
  exports: [JellyfinService],
})
export class JellyfinModule {}
