import { Module } from '@nestjs/common';
import { ConfigModule } from './modules/config/config.module.js';
import { LoggerModule } from './modules/logger/logger.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { DatabaseModule } from './database/database.module.js';
import { AppController } from './app.controller.js';

@Module({
  imports: [ConfigModule, LoggerModule, DatabaseModule, HealthModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
