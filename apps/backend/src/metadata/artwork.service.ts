import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { JellyfinService } from '../jellyfin/jellyfin.service.js';
import { ProviderRegistryService } from '../providers/provider-registry.service.js';
import { ProviderArtwork } from '@metafin/shared';

// Define artwork search options locally since it's not in shared yet
interface ProviderArtworkSearchOptions {
  query?: string;
  id?: string;
  types?: string[];
  language?: string;
  year?: number;
}

export interface ArtworkCandidate {
  id?: string;
  type: string; // Primary, Backdrop, Thumb, Logo, Banner
  url: string;
  width?: number;
  height?: number;
  language?: string;
  source: string;
  confidence: number;
  isApplied?: boolean;
}

export interface ArtworkSearchOptions {
  itemId: string;
  types?: string[];
  language?: string;
  autoStore?: boolean;
  forceRefresh?: boolean;
}

export interface ArtworkAggregationResult {
  itemId: string;
  candidatesFound: number;
  candidatesStored: number;
  errors: string[];
  bestCandidates: {
    [artworkType: string]: ArtworkCandidate;
  };
}

@Injectable()
export class ArtworkService {
  private readonly logger = new Logger(ArtworkService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jellyfinService: JellyfinService,
    private readonly providerRegistry: ProviderRegistryService
  ) {}

  async aggregateArtworkForItem(
    options: ArtworkSearchOptions
  ): Promise<ArtworkAggregationResult> {
    this.logger.debug(
      `Starting artwork aggregation for item ${options.itemId}`
    );

    const result: ArtworkAggregationResult = {
      itemId: options.itemId,
      candidatesFound: 0,
      candidatesStored: 0,
      errors: [],
      bestCandidates: {},
    };

    try {
      // Get item details for search
      const item = await this.databaseService.item.findUnique({
        where: { id: options.itemId },
        select: {
          id: true,
          name: true,
          type: true,
          year: true,
          providerIds: true,
        },
      });

      if (!item) {
        throw new Error('Item not found');
      }

      // Clear existing candidates if force refresh
      if (options.forceRefresh) {
        await this.databaseService.artworkCandidate.deleteMany({
          where: { itemId: options.itemId },
        });
      }

      // Search artwork from providers
      const candidates = await this.searchArtworkFromProviders(
        item,
        options.types || ['Primary', 'Backdrop', 'Thumb'],
        options.language
      );

      result.candidatesFound = candidates.length;

      // Store candidates if requested
      if (options.autoStore && candidates.length > 0) {
        const storedCount = await this.storeCandidates(
          options.itemId,
          candidates
        );
        result.candidatesStored = storedCount;
      }

      // Identify best candidates by type
      result.bestCandidates = this.getBestCandidatesByType(candidates);

      this.logger.debug(
        `Artwork aggregation completed for item ${options.itemId}: ${result.candidatesFound} candidates found, ${result.candidatesStored} stored`
      );
    } catch (error) {
      const errorMessage = `Artwork aggregation failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`;
      this.logger.error(errorMessage);
      result.errors.push(errorMessage);
    }

    return result;
  }

  private async searchArtworkFromProviders(
    item: {
      name: string;
      type: string;
      year?: number | null;
      providerIds: string;
    },
    artworkTypes: string[],
    language?: string
  ): Promise<ArtworkCandidate[]> {
    const candidates: ArtworkCandidate[] = [];
    const providers = this.providerRegistry.getAvailableProviders();

    // Parse provider IDs for targeted searches
    let providerIds: Record<string, string> = {};
    try {
      providerIds = JSON.parse(item.providerIds || '{}');
    } catch {
      // Invalid JSON, continue without provider IDs
    }

    for (const provider of providers) {
      if (!provider) {
        continue;
      }

      // Check if provider supports artwork search (optional method)
      const searchArtwork = (provider as unknown as { searchArtwork?: (options: ProviderArtworkSearchOptions) => Promise<ProviderArtwork[]> }).searchArtwork;
      if (typeof searchArtwork !== 'function') {
        this.logger.debug(
          `Provider ${provider.type} does not support artwork search`
        );
        continue;
      }

      try {
        this.logger.debug(
          `Searching artwork from ${provider.type} for ${item.name}`
        );

        // Use provider-specific ID if available, otherwise search by name
        const searchOptions: ProviderArtworkSearchOptions = {
          query: item.name,
          types: artworkTypes,
          language: language || 'en',
        };

        // Add provider-specific ID if available
        const providerId = providerIds[provider.type];
        if (providerId) {
          searchOptions.id = providerId;
        }

        if (item.year) {
          searchOptions.year = item.year;
        }

        const artworkResults: ProviderArtwork[] = await searchArtwork.call(provider, searchOptions);

        for (const artwork of artworkResults) {
          candidates.push({
            type: artwork.type,
            url: artwork.url,
            width: artwork.width,
            height: artwork.height,
            language: artwork.language || language || 'en',
            source: provider.type,
            confidence: (artwork as unknown as { confidence?: number }).confidence || 0.5,
          });
        }
      } catch (error) {
        this.logger.warn(
          `Provider ${provider.type} artwork search failed: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    return candidates;
  }

  private async storeCandidates(
    itemId: string,
    candidates: ArtworkCandidate[]
  ): Promise<number> {
    if (candidates.length === 0) {
      return 0;
    }

    try {
      // Prepare data for bulk insert
      const candidateData = candidates.map((candidate) => ({
        itemId,
        type: candidate.type,
        url: candidate.url,
        width: candidate.width,
        height: candidate.height,
        language: candidate.language,
        source: candidate.source,
        confidence: candidate.confidence,
        isApplied: false,
      }));

      // Use createMany for efficient bulk insert (SQLite doesn't support skipDuplicates)
      const result = await this.databaseService.artworkCandidate.createMany({
        data: candidateData,
      });

      this.logger.debug(
        `Stored ${result.count} artwork candidates for item ${itemId}`
      );

      return result.count || 0;
    } catch (error) {
      this.logger.error(
        `Failed to store artwork candidates: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      return 0;
    }
  }

  private getBestCandidatesByType(
    candidates: ArtworkCandidate[]
  ): Record<string, ArtworkCandidate> {
    const bestCandidates: Record<string, ArtworkCandidate> = {};

    // Group candidates by type and find the best one for each type
    const candidatesByType: Record<string, ArtworkCandidate[]> = {};

    for (const candidate of candidates) {
      if (!candidatesByType[candidate.type]) {
        candidatesByType[candidate.type] = [];
      }
      candidatesByType[candidate.type].push(candidate);
    }

    // Find best candidate for each type based on confidence, dimensions, and source
    for (const [type, typeCandidates] of Object.entries(candidatesByType)) {
      const sortedCandidates = typeCandidates.sort((a, b) => {
        // Primary sort: confidence
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence;
        }

        // Secondary sort: resolution (higher is better)
        const aResolution = (a.width || 0) * (a.height || 0);
        const bResolution = (b.width || 0) * (b.height || 0);
        if (bResolution !== aResolution) {
          return bResolution - aResolution;
        }

        // Tertiary sort: prefer certain sources
        const sourceOrder = ['tmdb', 'tvmaze', 'wikidata'];
        const aSourceIndex = sourceOrder.indexOf(a.source);
        const bSourceIndex = sourceOrder.indexOf(b.source);
        return bSourceIndex - aSourceIndex;
      });

      if (sortedCandidates.length > 0) {
        bestCandidates[type] = sortedCandidates[0];
      }
    }

    return bestCandidates;
  }

  async getCandidatesForItem(
    itemId: string,
    type?: string,
    source?: string,
    includeApplied = true
  ): Promise<ArtworkCandidate[]> {
    const where: Record<string, unknown> = { itemId };

    if (type) {
      where.type = type;
    }

    if (source) {
      where.source = source;
    }

    if (!includeApplied) {
      where.isApplied = false;
    }

    const candidates = await this.databaseService.artworkCandidate.findMany({
      where,
      orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
    });

    return candidates.map((candidate) => ({
      id: candidate.id,
      type: candidate.type,
      url: candidate.url,
      width: candidate.width || undefined,
      height: candidate.height || undefined,
      language: candidate.language || undefined,
      source: candidate.source,
      confidence: candidate.confidence,
      isApplied: candidate.isApplied,
    }));
  }

  async applyArtworkCandidate(
    candidateId: string,
    _userId?: string
  ): Promise<void> {
    const candidate = await this.databaseService.artworkCandidate.findUnique({
      where: { id: candidateId },
      include: {
        item: {
          select: {
            id: true,
            jellyfinId: true,
            name: true,
          },
        },
      },
    });

    if (!candidate) {
      throw new Error('Artwork candidate not found');
    }

    // Apply artwork to Jellyfin
    await this.jellyfinService.applyItemArtwork(
      candidate.item.jellyfinId,
      candidate.type,
      candidate.url
    );

    // Mark candidate as applied
    await this.databaseService.artworkCandidate.update({
      where: { id: candidateId },
      data: { isApplied: true },
    });

    // Update item artwork flag
    await this.databaseService.item.update({
      where: { id: candidate.itemId },
      data: {
        hasArtwork: true,
        lastSyncAt: new Date(),
      },
    });

    this.logger.log(
      `Applied ${candidate.type} artwork for item ${candidate.item.name} (${candidate.source})`
    );
  }

  async bulkAggregateArtwork(
    itemIds: string[],
    options: Omit<ArtworkSearchOptions, 'itemId'> = {}
  ): Promise<ArtworkAggregationResult[]> {
    this.logger.log(
      `Starting bulk artwork aggregation for ${itemIds.length} items`
    );

    const results: ArtworkAggregationResult[] = [];

    // Process items in batches to avoid overwhelming providers
    const batchSize = 5;
    for (let i = 0; i < itemIds.length; i += batchSize) {
      const batch = itemIds.slice(i, i + batchSize);

      const batchPromises = batch.map((itemId) =>
        this.aggregateArtworkForItem({ ...options, itemId })
      );

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          this.logger.error(
            `Bulk artwork aggregation failed for item: ${result.reason}`
          );
          results.push({
            itemId: 'unknown',
            candidatesFound: 0,
            candidatesStored: 0,
            errors: [result.reason],
            bestCandidates: {},
          });
        }
      }

      // Add delay between batches to respect rate limits
      if (i + batchSize < itemIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    const successful = results.filter((r) => r.errors.length === 0).length;
    this.logger.log(
      `Bulk artwork aggregation completed: ${successful}/${itemIds.length} items processed successfully`
    );

    return results;
  }

  async cleanupArtworkCandidates(
    olderThanDays = 30,
    keepApplied = true
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const where: Record<string, unknown> = {
      createdAt: { lt: cutoffDate },
    };

    if (keepApplied) {
      where.isApplied = false;
    }

    const result = await this.databaseService.artworkCandidate.deleteMany({
      where,
    });

    this.logger.log(
      `Cleaned up ${result.count} old artwork candidates (older than ${olderThanDays} days)`
    );

    return result.count;
  }
}