import { BaseProvider } from '../base-provider.js';
import {
  ProviderType,
  type ProviderCapabilities,
  type ProviderSearchResult,
  type ProviderSeries,
  type ProviderArtwork,
  type ProviderConfig,
} from '@metafin/shared';
import type {
  SearchOptions,
  MetadataOptions,
  ArtworkOptions,
} from '../base-provider.js';

interface WikidataSearchResult {
  id: string;
  title: string;
  description?: string;
  concepturi: string;
  url: string;
  pageid: number;
}

interface WikidataSearchResponse {
  search: WikidataSearchResult[];
}

interface WikidataEntityResponse {
  entities: Record<string, WikidataEntity>;
}

interface WikidataEntity {
  id: string;
  type: string;
  labels: Record<string, { language: string; value: string }>;
  descriptions: Record<string, { language: string; value: string }>;
  claims: Record<string, WikidataClaim[]>;
  sitelinks: Record<string, { site: string; title: string; url: string }>;
}

interface WikidataClaim {
  type: string;
  mainsnak: {
    snaktype: string;
    property: string;
    datavalue?: {
      type: string;
      value: unknown;
    };
  };
}

export class WikidataProvider extends BaseProvider {
  private readonly baseUrl = 'https://www.wikidata.org/w/api.php';
  private readonly sparqlUrl = 'https://query.wikidata.org/sparql';

  constructor(config: ProviderConfig) {
    super(config);
  }

  get type(): ProviderType {
    return ProviderType.Wikidata;
  }

  get capabilities(): ProviderCapabilities {
    return {
      search: true,
      metadata: true,
      artwork: false, // Wikidata doesn't provide direct artwork URLs
      episodes: false, // Wikidata doesn't have detailed episode data
      multiLanguage: true,
    };
  }

  get name(): string {
    return 'Wikidata';
  }

  private async request<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<T> {
    await this.enforceRateLimit();

    const url = new URL(endpoint, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'metafin/0.1.0 (https://github.com/metafin/metafin)',
        },
      });
      clearTimeout(timeoutId);

      if (response.status === 429) {
        const retryAfter = parseInt(
          response.headers.get('retry-after') || '60'
        );
        throw this.createError(
          'RATE_LIMITED',
          'Rate limit exceeded',
          true,
          retryAfter
        );
      }

      if (!response.ok) {
        throw this.createError(
          'HTTP_ERROR',
          `Wikidata API error: ${response.status} ${response.statusText}`,
          response.status >= 500
        );
      }

      return response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createError('TIMEOUT', 'Request timeout', true);
      }
      throw error;
    }
  }

  private async sparqlQuery<T>(query: string): Promise<T> {
    await this.enforceRateLimit();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(this.sparqlUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'metafin/0.1.0 (https://github.com/metafin/metafin)',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          query,
          format: 'json',
        }),
      });
      clearTimeout(timeoutId);

      if (response.status === 429) {
        const retryAfter = parseInt(
          response.headers.get('retry-after') || '60'
        );
        throw this.createError(
          'RATE_LIMITED',
          'Rate limit exceeded',
          true,
          retryAfter
        );
      }

      if (!response.ok) {
        throw this.createError(
          'HTTP_ERROR',
          `SPARQL error: ${response.status} ${response.statusText}`,
          response.status >= 500
        );
      }

      return response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createError('TIMEOUT', 'Request timeout', true);
      }
      throw error;
    }
  }

  async search(options: SearchOptions): Promise<ProviderSearchResult[]> {
    try {
      // Search for TV series in Wikidata
      const searchResponse = await this.request<WikidataSearchResponse>('', {
        action: 'wbsearchentities',
        search: `${options.query} television series`,
        language: options.language || 'en',
        format: 'json',
        type: 'item',
        limit: '10',
      });

      if (!searchResponse.search || searchResponse.search.length === 0) {
        return [];
      }

      // Get additional metadata for each search result
      const entityIds = searchResponse.search.map((item) => item.id);
      const entityResponse = await this.request<WikidataEntityResponse>('', {
        action: 'wbgetentities',
        ids: entityIds.join('|'),
        format: 'json',
        props: 'labels|descriptions|claims',
        languages: options.language || 'en',
      });

      return searchResponse.search
        .map((item, index) => {
          const entity = entityResponse.entities[item.id];
          if (!entity) return null;

          return this.mapEntityToSearchResult(entity, index);
        })
        .filter((item): item is ProviderSearchResult => item !== null);
    } catch (error) {
      if (error instanceof Error && error.message.includes('NOT_FOUND')) {
        return [];
      }
      throw error;
    }
  }

  async getMetadata(
    id: string,
    options?: MetadataOptions
  ): Promise<ProviderSeries> {
    const entityResponse = await this.request<WikidataEntityResponse>('', {
      action: 'wbgetentities',
      ids: id,
      format: 'json',
      props: 'labels|descriptions|claims|sitelinks',
      languages: options?.language || 'en',
    });

    const entity = entityResponse.entities[id];
    if (!entity) {
      throw this.createError('NOT_FOUND', 'Entity not found', false);
    }

    return this.mapEntityToSeries(entity, options?.language);
  }

  async getArtwork(
    _id: string,
    _options?: ArtworkOptions
  ): Promise<ProviderArtwork[]> {
    // Wikidata doesn't provide direct artwork URLs
    return [];
  }

  private mapEntityToSearchResult(
    entity: WikidataEntity,
    index: number
  ): ProviderSearchResult {
    const label = Object.values(entity.labels)[0]?.value || entity.id;
    const description = Object.values(entity.descriptions)[0]?.value || '';

    // Extract publication year from claims (P580 - start time)
    const startTimeClaims = entity.claims['P580'] || [];
    let year: number | undefined;

    if (startTimeClaims.length > 0) {
      const startTime = startTimeClaims[0].mainsnak.datavalue?.value;
      if (typeof startTime === 'string') {
        year = new Date(startTime).getFullYear();
      }
    }

    return {
      id: entity.id,
      name: label,
      year,
      overview: description,
      confidence: Math.max(0.1, 1 - index * 0.1), // Simple scoring based on search order
      language: Object.values(entity.labels)[0]?.language || 'en',
    };
  }

  private mapEntityToSeries(
    entity: WikidataEntity,
    language = 'en'
  ): ProviderSeries {
    const label =
      entity.labels[language]?.value ||
      Object.values(entity.labels)[0]?.value ||
      entity.id;
    const description =
      entity.descriptions[language]?.value ||
      Object.values(entity.descriptions)[0]?.value ||
      '';

    // Extract various properties from claims
    const claims = entity.claims;

    // Start time (P580)
    const startDate = this.extractDateFromClaims(claims['P580']);

    // End time (P582)
    const endDate = this.extractDateFromClaims(claims['P582']);

    // Country of origin (P495)
    const countryItems = this.extractEntityReferencesFromClaims(claims['P495']);

    // Original broadcaster (P449)
    const broadcasterItems = this.extractEntityReferencesFromClaims(
      claims['P449']
    );

    // Genre (P136)
    const genreItems = this.extractEntityReferencesFromClaims(claims['P136']);

    return {
      id: entity.id,
      name: label,
      originalName: label,
      overview: description,
      year: startDate ? new Date(startDate).getFullYear() : undefined,
      startDate,
      endDate,
      country: countryItems[0], // Use first country if multiple
      network: broadcasterItems[0], // Use first broadcaster if multiple
      language,
      genres: genreItems,
    };
  }

  private extractDateFromClaims(claims?: WikidataClaim[]): string | undefined {
    if (!claims || claims.length === 0) return undefined;

    const dateValue = claims[0].mainsnak.datavalue?.value;
    if (typeof dateValue === 'string') {
      return dateValue;
    }

    return undefined;
  }

  private extractNumberFromClaims(
    claims?: WikidataClaim[]
  ): number | undefined {
    if (!claims || claims.length === 0) return undefined;

    const numberValue = claims[0].mainsnak.datavalue?.value;
    if (typeof numberValue === 'number') {
      return numberValue;
    }

    return undefined;
  }

  private extractEntityReferencesFromClaims(
    claims?: WikidataClaim[]
  ): string[] {
    if (!claims || claims.length === 0) return [];

    return claims
      .map((claim) => {
        const value = claim.mainsnak.datavalue?.value;
        if (typeof value === 'object' && value && 'id' in value) {
          return (value as { id: string }).id;
        }
        return null;
      })
      .filter((id): id is string => id !== null);
  }
}
