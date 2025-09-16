import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { Config } from './config.schema.js';
import { ProviderType } from '@metafin/shared';

@Injectable()
export class ConfigService {
  constructor(
    private readonly nestConfigService: NestConfigService<Config, true>
  ) {}

  get<K extends keyof Config>(key: K): Config[K] {
    return this.nestConfigService.get(key, { infer: true });
  }

  getOrThrow<K extends keyof Config>(key: K): NonNullable<Config[K]> {
    return this.nestConfigService.getOrThrow(key, { infer: true });
  }

  // Convenience methods for commonly used config
  get nodeEnv(): Config['NODE_ENV'] {
    return this.get('NODE_ENV');
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  get appPort(): Config['APP_PORT'] {
    return this.get('APP_PORT');
  }

  get basePath(): Config['BASE_PATH'] {
    return this.get('BASE_PATH');
  }

  get jellyfinUrl(): Config['JELLYFIN_URL'] {
    return this.get('JELLYFIN_URL');
  }

  get jellyfinApiKey(): Config['JELLYFIN_API_KEY'] {
    return this.get('JELLYFIN_API_KEY');
  }

  get tmdbApiKey(): Config['TMDB_API_KEY'] {
    return this.get('TMDB_API_KEY');
  }

  get databaseUrl(): Config['DATABASE_URL'] {
    return this.get('DATABASE_URL');
  }

  get trustProxy(): boolean {
    return this.get('TRUST_PROXY') === 'true';
  }

  get defaultLocale(): Config['DEFAULT_LOCALE'] {
    return this.get('DEFAULT_LOCALE');
  }

  get logLevel(): Config['LOG_LEVEL'] {
    return this.get('LOG_LEVEL');
  }

  // Runtime configuration checks
  get hasJellyfinConfig(): boolean {
    return !!(this.jellyfinUrl && this.jellyfinApiKey);
  }

  get hasTmdbConfig(): boolean {
    return !!this.tmdbApiKey;
  }

  // Validation helpers
  requireJellyfinConfig(): { url: string; apiKey: string } {
    const url = this.jellyfinUrl;
    const apiKey = this.jellyfinApiKey;

    if (!url || !apiKey) {
      throw new Error(
        'Jellyfin configuration required. Please set JELLYFIN_URL and JELLYFIN_API_KEY environment variables.'
      );
    }

    return { url, apiKey };
  }

  getProviderConfigs() {
    return {
      tvmaze: {
        type: ProviderType.TVMaze,
        enabled: true,
        rateLimit: 1, // TVMaze allows 1 request per second
        timeout: 30000,
      },
      wikidata: {
        type: ProviderType.Wikidata,
        enabled: true,
        rateLimit: 5, // Wikidata allows higher rate limits
        timeout: 30000,
      },
      tmdb: {
        type: ProviderType.TMDb,
        enabled: !!this.tmdbApiKey,
        apiKey: this.tmdbApiKey,
        rateLimit: 40, // TMDb allows 40 requests per 10 seconds
        timeout: 30000,
      },
    };
  }
}
