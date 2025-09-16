import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';
import { JellyfinModule } from '../../jellyfin/jellyfin.module.js';

@Module({
  imports: [TerminusModule, JellyfinModule],
  controllers: [HealthController],
})
export class HealthModule {}
