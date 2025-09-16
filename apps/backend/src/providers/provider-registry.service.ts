import { Injectable } from '@nestjs/common';
import { ConfigService } from '../modules/config/config.service.js';
import { LoggerService } from '../modules/logger/logger.service.js';
import { BaseProvider } from './base-provider.js';
import type {
  ProviderType,
  ProviderConfig,
  ProviderSearchResult,
  ProviderSeries,
  ProviderArtwork,
} from '@metafin/shared';
import type {
  SearchOptions,
  MetadataOptions,
  ArtworkOptions,
} from './base-provider.js';

export interface ProviderResults<T> {
  provider: ProviderType;
  results: T;
  error?: string;
}

@Injectable()
export class ProviderRegistryService {
  private providers = new Map<ProviderType, BaseProvider>();

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService
  ) {}

  registerProvider(provider: BaseProvider): void {
    this.providers.set(provider.type, provider);
    this.logger.log(
      `Registered provider: ${provider.name}`,
      'ProviderRegistry'
    );
  }

  getProvider(type: ProviderType): BaseProvider | undefined {
    return this.providers.get(type);
  }

  getAvailableProviders(): BaseProvider[] {
    return Array.from(this.providers.values()).filter((p) => p.isEnabled);
  }

  getProvidersByCapability(
    capability: keyof import('@metafin/shared').ProviderCapabilities
  ): BaseProvider[] {
    return this.getAvailableProviders().filter(
      (p) => p.capabilities[capability]
    );
  }

  async searchAll(
    options: SearchOptions
  ): Promise<ProviderResults<ProviderSearchResult[]>[]> {
    const searchProviders = this.getProvidersByCapability('search');
    const promises = searchProviders.map(async (provider) => {
      try {
        this.logger.debug(
          `Searching with ${provider.name}: ${options.query}`,
          'ProviderRegistry'
        );
        const results = await provider.search(options);
        this.logger.debug(
          `${provider.name} returned ${results.length} results`,
          'ProviderRegistry'
        );

        return {
          provider: provider.type,
          results,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(
          `Search failed for ${provider.name}: ${errorMessage}`,
          'ProviderRegistry'
        );

        return {
          provider: provider.type,
          results: [],
          error: errorMessage,
        };
      }
    });

    return Promise.all(promises);
  }

  async getMetadataAll(
    searches: Array<{ provider: ProviderType; id: string }>,
    options?: MetadataOptions
  ): Promise<ProviderResults<ProviderSeries>[]> {
    const promises = searches.map(async ({ provider: providerType, id }) => {
      const provider = this.getProvider(providerType);

      if (!provider || !provider.isEnabled) {
        return {
          provider: providerType,
          results: {} as ProviderSeries,
          error: 'Provider not available',
        };
      }

      if (!provider.capabilities.metadata) {
        return {
          provider: providerType,
          results: {} as ProviderSeries,
          error: 'Provider does not support metadata',
        };
      }

      try {
        this.logger.debug(
          `Getting metadata from ${provider.name}: ${id}`,
          'ProviderRegistry'
        );
        const results = await provider.getMetadata(id, options);
        this.logger.debug(
          `${provider.name} returned metadata for ${results.name}`,
          'ProviderRegistry'
        );

        return {
          provider: providerType,
          results,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(
          `Metadata fetch failed for ${provider.name}: ${errorMessage}`,
          'ProviderRegistry'
        );

        return {
          provider: providerType,
          results: {} as ProviderSeries,
          error: errorMessage,
        };
      }
    });

    return Promise.all(promises);
  }

  async getArtworkAll(
    searches: Array<{ provider: ProviderType; id: string }>,
    options?: ArtworkOptions
  ): Promise<ProviderResults<ProviderArtwork[]>[]> {
    const promises = searches.map(async ({ provider: providerType, id }) => {
      const provider = this.getProvider(providerType);

      if (!provider || !provider.isEnabled) {
        return {
          provider: providerType,
          results: [],
          error: 'Provider not available',
        };
      }

      if (!provider.capabilities.artwork) {
        return {
          provider: providerType,
          results: [],
          error: 'Provider does not support artwork',
        };
      }

      try {
        this.logger.debug(
          `Getting artwork from ${provider.name}: ${id}`,
          'ProviderRegistry'
        );
        const results = await provider.getArtwork(id, options);
        this.logger.debug(
          `${provider.name} returned ${results.length} artwork items`,
          'ProviderRegistry'
        );

        return {
          provider: providerType,
          results,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(
          `Artwork fetch failed for ${provider.name}: ${errorMessage}`,
          'ProviderRegistry'
        );

        return {
          provider: providerType,
          results: [],
          error: errorMessage,
        };
      }
    });

    return Promise.all(promises);
  }

  async healthCheckAll(): Promise<
    Array<{
      provider: ProviderType;
      name: string;
      healthy: boolean;
      message?: string;
    }>
  > {
    const providers = Array.from(this.providers.values());
    const promises = providers.map(async (provider) => {
      try {
        const health = await provider.healthCheck();
        return {
          provider: provider.type,
          name: provider.name,
          healthy: health.healthy,
          message: health.message,
        };
      } catch (error) {
        return {
          provider: provider.type,
          name: provider.name,
          healthy: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    return Promise.all(promises);
  }

  getProviderConfigs(): ProviderConfig[] {
    return Array.from(this.providers.values()).map((provider) => ({
      type: provider.type,
      enabled: provider.isEnabled,
      rateLimit: provider.rateLimit,
      timeout: 30000, // Default timeout
    }));
  }
}
