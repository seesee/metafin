import type {
  ProviderCapabilities,
  ProviderSearchResult,
  ProviderSeries,
  ProviderArtwork,
  ProviderType,
  ProviderConfig,
  ProviderError,
} from '@metafin/shared';

export interface SearchOptions {
  query: string;
  year?: number;
  language?: string;
  includeAdult?: boolean;
}

export interface MetadataOptions {
  language?: string;
  includeEpisodes?: boolean;
}

export interface ArtworkOptions {
  language?: string;
  includeAll?: boolean;
}

export abstract class BaseProvider {
  protected readonly config: ProviderConfig;
  protected lastRequestTime = 0;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  abstract get type(): ProviderType;
  abstract get capabilities(): ProviderCapabilities;
  abstract get name(): string;

  get isEnabled(): boolean {
    return this.config.enabled;
  }

  get rateLimit(): number {
    return this.config.rateLimit;
  }

  protected async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minimumInterval = 1000 / this.config.rateLimit;

    if (timeSinceLastRequest < minimumInterval) {
      const waitTime = minimumInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  protected createError(
    code: string,
    message: string,
    retryable = false,
    retryAfter?: number
  ): ProviderError {
    return {
      provider: this.type,
      code,
      message,
      retryable,
      retryAfter,
    };
  }

  abstract search(options: SearchOptions): Promise<ProviderSearchResult[]>;
  abstract getMetadata(
    id: string,
    options?: MetadataOptions
  ): Promise<ProviderSeries>;
  abstract getArtwork(
    id: string,
    options?: ArtworkOptions
  ): Promise<ProviderArtwork[]>;

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      // Simple search test with a well-known show
      const results = await this.search({ query: 'Breaking Bad' });
      return {
        healthy: results.length > 0,
        message:
          results.length > 0 ? 'OK' : 'No results returned for test query',
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
