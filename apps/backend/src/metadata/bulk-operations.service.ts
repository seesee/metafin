import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { JellyfinService } from '../jellyfin/jellyfin.service.js';
import { ProviderRegistryService } from '../providers/provider-registry.service.js';
import { ProviderType } from '@metafin/shared';

export interface BulkMetadataUpdate {
  itemId: string;
  updates: {
    name?: string;
    overview?: string;
    year?: number;
    genres?: string[];
    tags?: string[];
    studios?: string[];
    people?: Array<{
      name: string;
      role?: string;
      type: string;
    }>;
  };
}

export interface BulkUpdateResult {
  itemId: string;
  success: boolean;
  error?: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
}

export interface BulkSearchAndMatch {
  itemIds: string[];
  provider?: string;
  autoApply?: boolean;
  confidenceThreshold?: number;
}

export interface BulkSearchResult {
  itemId: string;
  matches: Array<{
    provider: string;
    confidence: number;
    metadata: Record<string, unknown>;
  }>;
  bestMatch?: {
    provider: string;
    confidence: number;
    metadata: Record<string, unknown>;
  };
}

@Injectable()
export class BulkOperationsService {
  private readonly logger = new Logger(BulkOperationsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jellyfinService: JellyfinService,
    private readonly providerRegistry: ProviderRegistryService
  ) {}

  async bulkUpdateMetadata(
    updates: BulkMetadataUpdate[]
  ): Promise<BulkUpdateResult[]> {
    this.logger.log(
      `Starting bulk metadata update for ${updates.length} items`
    );

    const results: BulkUpdateResult[] = [];

    for (const update of updates) {
      try {
        const result = await this.updateSingleItem(update);
        results.push(result);
      } catch (error) {
        this.logger.error(
          `Failed to update item ${update.itemId}: ${(error as Error).message}`
        );
        results.push({
          itemId: update.itemId,
          success: false,
          error: (error as Error).message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    this.logger.log(
      `Bulk update completed: ${successCount}/${updates.length} items updated`
    );

    return results;
  }

  private async updateSingleItem(
    update: BulkMetadataUpdate
  ): Promise<BulkUpdateResult> {
    // Get current item
    const item = await this.databaseService.item.findUnique({
      where: { id: update.itemId },
      select: {
        id: true,
        jellyfinId: true,
        name: true,
        overview: true,
        year: true,
        genres: true,
        tags: true,
        studios: true,
        people: true,
      },
    });

    if (!item) {
      throw new Error('Item not found');
    }

    // Calculate changes
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const updateData: Record<string, unknown> = {};

    if (
      update.updates.name !== undefined &&
      update.updates.name !== item.name
    ) {
      changes.name = { from: item.name, to: update.updates.name };
      updateData.name = update.updates.name;
    }

    if (
      update.updates.overview !== undefined &&
      update.updates.overview !== item.overview
    ) {
      changes.overview = { from: item.overview, to: update.updates.overview };
      updateData.overview = update.updates.overview;
    }

    if (
      update.updates.year !== undefined &&
      update.updates.year !== item.year
    ) {
      changes.year = { from: item.year, to: update.updates.year };
      updateData.year = update.updates.year;
    }

    if (update.updates.genres !== undefined) {
      const currentGenres = item.genres || [];
      if (
        JSON.stringify((currentGenres as string[]).sort()) !==
        JSON.stringify(update.updates.genres.sort())
      ) {
        changes.genres = { from: currentGenres, to: update.updates.genres };
        updateData.genres = update.updates.genres;
      }
    }

    if (update.updates.tags !== undefined) {
      const currentTags = item.tags || [];
      if (
        JSON.stringify((currentTags as string[]).sort()) !==
        JSON.stringify(update.updates.tags.sort())
      ) {
        changes.tags = { from: currentTags, to: update.updates.tags };
        updateData.tags = update.updates.tags;
      }
    }

    if (update.updates.studios !== undefined) {
      const currentStudios = item.studios || [];
      if (
        JSON.stringify((currentStudios as string[]).sort()) !==
        JSON.stringify(update.updates.studios.sort())
      ) {
        changes.studios = { from: currentStudios, to: update.updates.studios };
        updateData.studios = update.updates.studios;
      }
    }

    if (update.updates.people !== undefined) {
      const currentPeople = item.people || [];
      if (
        JSON.stringify(currentPeople) !== JSON.stringify(update.updates.people)
      ) {
        changes.people = { from: currentPeople, to: update.updates.people };
        updateData.people = update.updates.people;
      }
    }

    // Only update if there are changes
    if (Object.keys(updateData).length === 0) {
      return {
        itemId: update.itemId,
        success: true,
        changes: {},
      };
    }

    // Update database
    await this.databaseService.item.update({
      where: { id: update.itemId },
      data: {
        ...updateData,
        lastSyncAt: new Date(),
      },
    });

    // Update Jellyfin
    try {
      await this.jellyfinService.updateItemMetadata(
        item.jellyfinId,
        updateData
      );
    } catch (error) {
      this.logger.warn(
        `Failed to update Jellyfin item ${item.jellyfinId}: ${(error as Error).message}`
      );
      // Don't fail the operation, just log the warning
    }

    return {
      itemId: update.itemId,
      success: true,
      changes,
    };
  }

  async bulkSearchAndMatch(
    request: BulkSearchAndMatch
  ): Promise<BulkSearchResult[]> {
    this.logger.log(
      `Starting bulk search and match for ${request.itemIds.length} items`
    );

    const results: BulkSearchResult[] = [];

    // Get items from database
    const items = await this.databaseService.item.findMany({
      where: { id: { in: request.itemIds } },
      select: {
        id: true,
        name: true,
        year: true,
        type: true,
      },
    });

    for (const item of items) {
      try {
        const searchResult = await this.searchItemMatches(
          item,
          request.provider
        );
        results.push(searchResult);
      } catch (error) {
        this.logger.error(
          `Failed to search matches for item ${item.id}: ${(error as Error).message}`
        );
        results.push({
          itemId: item.id,
          matches: [],
        });
      }
    }

    // Auto-apply best matches if requested
    if (request.autoApply) {
      await this.autoApplyBestMatches(
        results,
        request.confidenceThreshold || 0.8
      );
    }

    return results;
  }

  private async searchItemMatches(
    item: { id: string; name: string; year?: number | null; type: string },
    providerType?: string
  ): Promise<BulkSearchResult> {
    const matches: Array<{
      provider: string;
      confidence: number;
      metadata: Record<string, unknown>;
    }> = [];

    const providersToSearch = providerType
      ? [this.providerRegistry.getProvider(providerType as ProviderType)]
      : this.providerRegistry.getAvailableProviders();

    for (const provider of providersToSearch) {
      if (!provider) continue;

      try {
        const searchResults = await provider.search({
          query: item.name,
          year: item.year || undefined,
        });

        for (const result of searchResults) {
          matches.push({
            provider: provider.type,
            confidence: result.confidence,
            metadata: result as unknown as Record<string, unknown>,
          });
        }
      } catch (error) {
        this.logger.warn(
          `Provider ${provider.type} search failed for ${item.name}: ${(error as Error).message}`
        );
      }
    }

    // Sort by confidence and find best match
    matches.sort((a, b) => b.confidence - a.confidence);
    const bestMatch = matches.length > 0 ? matches[0] : undefined;

    return {
      itemId: item.id,
      matches,
      bestMatch,
    };
  }

  private async autoApplyBestMatches(
    results: BulkSearchResult[],
    confidenceThreshold: number
  ): Promise<void> {
    const applicableMatches = results.filter(
      (result) =>
        result.bestMatch && result.bestMatch.confidence >= confidenceThreshold
    );

    this.logger.log(
      `Auto-applying ${applicableMatches.length} matches with confidence >= ${confidenceThreshold}`
    );

    const updates: BulkMetadataUpdate[] = applicableMatches.map((result) => {
      const metadata = result.bestMatch!.metadata;
      return {
        itemId: result.itemId,
        updates: {
          name: metadata.name as string,
          overview: metadata.overview as string,
          year: metadata.year as number,
          genres: metadata.genres as string[],
          // Map other fields as needed
        },
      };
    });

    if (updates.length > 0) {
      await this.bulkUpdateMetadata(updates);
    }
  }

  async bulkAddToCollection(
    collectionId: string,
    itemIds: string[]
  ): Promise<BulkUpdateResult[]> {
    this.logger.log(
      `Adding ${itemIds.length} items to collection ${collectionId}`
    );

    try {
      // Verify collection exists
      const collection = await this.databaseService.collection.findUnique({
        where: { id: collectionId },
        select: { id: true, name: true },
      });

      if (!collection) {
        throw new Error('Collection not found');
      }

      // Verify all items exist
      const items = await this.databaseService.item.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, jellyfinId: true },
      });

      if (items.length !== itemIds.length) {
        const foundIds = items.map((item) => item.id);
        const missingIds = itemIds.filter((id) => !foundIds.includes(id));
        throw new Error(`Items not found: ${missingIds.join(', ')}`);
      }

      // Add items to collection
      await this.databaseService.collection.update({
        where: { id: collectionId },
        data: {
          items: {
            connect: itemIds.map((id) => ({ id })),
          },
        },
      });

      return itemIds.map((itemId) => ({
        itemId,
        success: true,
        changes: {
          collection: {
            from: null,
            to: collection.name,
          },
        },
      }));
    } catch (error) {
      this.logger.error(
        `Bulk add to collection failed: ${(error as Error).message}`
      );
      return itemIds.map((itemId) => ({
        itemId,
        success: false,
        error: (error as Error).message,
      }));
    }
  }

  async bulkRemoveFromCollection(
    collectionId: string,
    itemIds: string[]
  ): Promise<BulkUpdateResult[]> {
    this.logger.log(
      `Removing ${itemIds.length} items from collection ${collectionId}`
    );

    try {
      // Verify collection exists
      const collection = await this.databaseService.collection.findUnique({
        where: { id: collectionId },
        select: { id: true, name: true },
      });

      if (!collection) {
        throw new Error('Collection not found');
      }

      // Remove items from collection
      await this.databaseService.collection.update({
        where: { id: collectionId },
        data: {
          items: {
            disconnect: itemIds.map((id) => ({ id })),
          },
        },
      });

      return itemIds.map((itemId) => ({
        itemId,
        success: true,
        changes: {
          collection: {
            from: collection.name,
            to: null,
          },
        },
      }));
    } catch (error) {
      this.logger.error(
        `Bulk remove from collection failed: ${(error as Error).message}`
      );
      return itemIds.map((itemId) => ({
        itemId,
        success: false,
        error: (error as Error).message,
      }));
    }
  }
}
