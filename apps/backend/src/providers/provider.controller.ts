import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { ProviderRegistryService } from './provider-registry.service.js';
import type {
  ProviderType,
  ProviderSearchResult,
  ProviderSeries,
  ProviderArtwork,
  ProviderConfig,
} from '@metafin/shared';

interface SearchRequest {
  query: string;
  year?: number;
  language?: string;
  includeAdult?: boolean;
}

interface MetadataRequest {
  searches: Array<{ provider: ProviderType; id: string }>;
  language?: string;
  includeEpisodes?: boolean;
}

interface ArtworkRequest {
  searches: Array<{ provider: ProviderType; id: string }>;
  language?: string;
  includeAll?: boolean;
}

@Controller('api/providers')
export class ProviderController {
  constructor(private readonly providerRegistry: ProviderRegistryService) {}

  @Get('configs')
  getProviderConfigs(): ProviderConfig[] {
    return this.providerRegistry.getProviderConfigs();
  }

  @Get('health')
  async getProviderHealth(): Promise<
    Array<{
      provider: ProviderType;
      name: string;
      healthy: boolean;
      message?: string;
    }>
  > {
    return this.providerRegistry.healthCheckAll();
  }

  @Post('search')
  async searchProviders(@Body() request: SearchRequest): Promise<
    Array<{
      provider: ProviderType;
      results: ProviderSearchResult[];
      error?: string;
    }>
  > {
    return this.providerRegistry.searchAll(request);
  }

  @Post('metadata')
  async getMetadata(@Body() request: MetadataRequest): Promise<
    Array<{
      provider: ProviderType;
      results: ProviderSeries;
      error?: string;
    }>
  > {
    return this.providerRegistry.getMetadataAll(request.searches, {
      language: request.language,
      includeEpisodes: request.includeEpisodes,
    });
  }

  @Post('artwork')
  async getArtwork(@Body() request: ArtworkRequest): Promise<
    Array<{
      provider: ProviderType;
      results: ProviderArtwork[];
      error?: string;
    }>
  > {
    return this.providerRegistry.getArtworkAll(request.searches, {
      language: request.language,
      includeAll: request.includeAll,
    });
  }

  @Get('search/:provider')
  async searchSingleProvider(
    @Param('provider') providerType: ProviderType,
    @Query('query') query: string,
    @Query('year') year?: number,
    @Query('language') language?: string,
    @Query('includeAdult') includeAdult?: boolean
  ): Promise<ProviderSearchResult[]> {
    const provider = this.providerRegistry.getProvider(providerType);

    if (!provider) {
      throw new Error(`Provider ${providerType} not found`);
    }

    if (!provider.isEnabled) {
      throw new Error(`Provider ${providerType} is not enabled`);
    }

    return provider.search({
      query,
      year: year ? parseInt(String(year)) : undefined,
      language,
      includeAdult,
    });
  }

  @Get('metadata/:provider/:id')
  async getSingleProviderMetadata(
    @Param('provider') providerType: ProviderType,
    @Param('id') id: string,
    @Query('language') language?: string,
    @Query('includeEpisodes') includeEpisodes?: boolean
  ): Promise<ProviderSeries> {
    const provider = this.providerRegistry.getProvider(providerType);

    if (!provider) {
      throw new Error(`Provider ${providerType} not found`);
    }

    if (!provider.isEnabled) {
      throw new Error(`Provider ${providerType} is not enabled`);
    }

    return provider.getMetadata(id, {
      language,
      includeEpisodes,
    });
  }

  @Get('artwork/:provider/:id')
  async getSingleProviderArtwork(
    @Param('provider') providerType: ProviderType,
    @Param('id') id: string,
    @Query('language') language?: string,
    @Query('includeAll') includeAll?: boolean
  ): Promise<ProviderArtwork[]> {
    const provider = this.providerRegistry.getProvider(providerType);

    if (!provider) {
      throw new Error(`Provider ${providerType} not found`);
    }

    if (!provider.isEnabled) {
      throw new Error(`Provider ${providerType} is not enabled`);
    }

    return provider.getArtwork(id, {
      language,
      includeAll,
    });
  }
}
