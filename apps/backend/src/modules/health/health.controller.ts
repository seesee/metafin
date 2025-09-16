import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { ConfigService } from '../config/config.service.js';
import { DatabaseService } from '../../database/database.service.js';
import { JellyfinService } from '../../jellyfin/jellyfin.service.js';

@Controller('api/health')
export class HealthController {
  private readonly startTime = new Date();

  constructor(
    private readonly health: HealthCheckService,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly jellyfinService: JellyfinService
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      async () => this.getHealthInfo(),
      async () => this.getDatabaseHealth(),
      async () => this.getJellyfinHealth(),
    ]);
  }

  private async getHealthInfo(): Promise<HealthIndicatorResult> {
    const now = new Date();
    const uptime = Math.floor(
      (now.getTime() - this.startTime.getTime()) / 1000
    );

    return {
      metafin: {
        status: 'up',
        info: {
          version: process.env.npm_package_version || '0.1.0',
          uptime,
          startTime: this.startTime.toISOString(),
          environment: this.configService.nodeEnv,
          basePath: this.configService.basePath,
          node: {
            version: process.version,
            platform: process.platform,
            arch: process.arch,
          },
          configuration: {
            hasJellyfinConfig: this.configService.hasJellyfinConfig,
            hasTmdbConfig: this.configService.hasTmdbConfig,
            defaultLocale: this.configService.defaultLocale,
          },
        },
      },
    };
  }

  private async getDatabaseHealth(): Promise<HealthIndicatorResult> {
    const dbHealth = await this.databaseService.healthCheck();
    const stats =
      dbHealth.status === 'up'
        ? await this.databaseService.getStats()
        : undefined;

    return {
      database: {
        status: dbHealth.status,
        info: {
          ...(dbHealth.info as Record<string, unknown>),
          stats,
        },
      },
    };
  }

  private async getJellyfinHealth(): Promise<HealthIndicatorResult> {
    if (!this.configService.hasJellyfinConfig) {
      return {
        jellyfin: {
          status: 'down',
          info: {
            error: 'Jellyfin not configured',
          },
        },
      };
    }

    const jellyfinHealth = await this.jellyfinService.checkHealth();
    return {
      jellyfin: jellyfinHealth,
    };
  }
}
