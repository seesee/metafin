import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '../modules/config/config.service.js';
import { LoggerService } from '../modules/logger/logger.service.js';

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService
  ) {
    super({
      datasources: {
        db: {
          url: configService.databaseUrl,
        },
      },
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'warn',
        },
        {
          emit: 'event',
          level: 'info',
        },
      ],
    });

    // Log database queries in development
    if (configService.isDevelopment) {
      (
        this as {
          $on: (
            event: string,
            callback: (event: {
              query: string;
              params: string;
              duration: number;
            }) => void
          ) => void;
        }
      ).$on('query', (e) => {
        this.logger.debug(`Query: ${e.query}`, 'Database');
        this.logger.debug(`Params: ${e.params}`, 'Database');
        this.logger.debug(`Duration: ${e.duration}ms`, 'Database');
      });
    }

    (
      this as {
        $on: (
          event: string,
          callback: (event: { message: string; target: string }) => void
        ) => void;
      }
    ).$on('error', (e) => {
      this.logger.error(`Database error: ${e.message}`, e.target, 'Database');
    });

    (
      this as {
        $on: (
          event: string,
          callback: (event: { message: string }) => void
        ) => void;
      }
    ).$on('warn', (e) => {
      this.logger.warn(`Database warning: ${e.message}`, 'Database');
    });

    (
      this as {
        $on: (
          event: string,
          callback: (event: { message: string }) => void
        ) => void;
      }
    ).$on('info', (e) => {
      this.logger.log(`Database info: ${e.message}`, 'Database');
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Database connected successfully', 'Database');

      // Ensure the database schema is up to date
      await this.ensureSchema();
    } catch (error) {
      this.logger.error(
        `Failed to connect to database: ${error}`,
        error instanceof Error ? error.stack : undefined,
        'Database'
      );
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      this.logger.log('Database disconnected', 'Database');
    } catch (error) {
      this.logger.error(
        `Error disconnecting from database: ${error}`,
        error instanceof Error ? error.stack : undefined,
        'Database'
      );
    }
  }

  async healthCheck(): Promise<{ status: 'up' | 'down'; info?: unknown }> {
    try {
      await this.$queryRaw`SELECT 1`;
      return { status: 'up' };
    } catch (error) {
      return {
        status: 'down',
        info: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  async getStats(): Promise<{
    itemCount: number;
    libraryCount: number;
    collectionCount: number;
    jobCount: number;
  }> {
    const [itemCount, libraryCount, collectionCount, jobCount] =
      await Promise.all([
        this.item.count(),
        this.library.count(),
        this.collection.count(),
        this.job.count(),
      ]);

    return {
      itemCount,
      libraryCount,
      collectionCount,
      jobCount,
    };
  }

  private async ensureSchema(): Promise<void> {
    try {
      // This is a simple check to ensure the database is accessible
      // In a production app, you might want to run migrations here
      await this
        .$queryRaw`SELECT name FROM sqlite_master WHERE type='table' LIMIT 1`;
      this.logger.log('Database schema verified', 'Database');
    } catch (error) {
      this.logger.warn(
        'Database schema verification failed - make sure to run migrations',
        'Database'
      );
      throw error;
    }
  }
}
