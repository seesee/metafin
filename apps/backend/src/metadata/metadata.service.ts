import { Injectable } from '@nestjs/common';
import { ConfigService } from '../modules/config/config.service.js';
import { LoggerService } from '../modules/logger/logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { JellyfinService } from '../jellyfin/jellyfin.service.js';
import { AppError } from '@metafin/shared';
import type {
  BulkOperationPreview,
  ItemDiff,
  DiffChange,
  ArtworkCandidate,
} from '@metafin/shared';

export interface MetadataUpdate {
  itemId: string;
  name?: string;
  overview?: string;
  genres?: string[];
  tags?: string[];
  studios?: string[];
  people?: Array<{ name: string; role?: string; type: string }>;
  providerIds?: Record<string, string>;
  premiereDate?: string;
  endDate?: string;
  year?: number;
  officialRating?: string;
  communityRating?: number;
}

export interface ArtworkUpdate {
  itemId: string;
  artworkType: string;
  url?: string;
  imageData?: Buffer;
  contentType?: string;
  deleteExisting?: boolean;
}

export interface CollectionUpdate {
  name: string;
  itemIds: string[];
  collectionId?: string;
  operation: 'create' | 'update' | 'delete' | 'add_items' | 'remove_items';
}

@Injectable()
export class MetadataService {
  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly database: DatabaseService,
    private readonly jellyfin: JellyfinService
  ) {}

  // Bulk metadata operations
  async previewBulkMetadataUpdate(
    updates: MetadataUpdate[]
  ): Promise<BulkOperationPreview> {
    const itemDiffs: ItemDiff[] = [];
    let totalApiCalls = 0;

    for (const update of updates) {
      try {
        const item = await this.database.item.findUnique({
          where: { jellyfinId: update.itemId },
        });

        if (!item) {
          this.logger.warn(
            `Item not found in database: ${update.itemId}`,
            'MetadataService'
          );
          continue;
        }

        const changes = this.calculateMetadataChanges(item, update);
        if (changes.length > 0) {
          itemDiffs.push({
            itemId: update.itemId,
            changes,
            hasConflicts: changes.some((c) => c.conflict),
            apiCallCount: 1, // One API call per item update
          });
          totalApiCalls += 1;
        }
      } catch (error) {
        this.logger.error(
          `Error previewing update for item ${update.itemId}: ${error}`,
          'MetadataService'
        );
      }
    }

    return {
      itemDiffs,
      totalApiCalls,
      estimatedDuration: totalApiCalls * 0.5, // Estimate 500ms per API call
      warnings: this.generatePreviewWarnings(itemDiffs),
    };
  }

  async applyBulkMetadataUpdates(updates: MetadataUpdate[]): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ itemId: string; error: string }>;
  }> {
    let successful = 0;
    let failed = 0;
    const errors: Array<{ itemId: string; error: string }> = [];

    for (const update of updates) {
      try {
        await this.applyMetadataUpdate(update);
        successful++;
      } catch (error) {
        failed++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push({ itemId: update.itemId, error: errorMessage });
        this.logger.error(
          `Failed to update metadata for item ${update.itemId}: ${errorMessage}`,
          'MetadataService'
        );
      }
    }

    this.logger.log(
      `Bulk metadata update completed: ${successful} successful, ${failed} failed`,
      'MetadataService'
    );
    return { successful, failed, errors };
  }

  private async applyMetadataUpdate(update: MetadataUpdate): Promise<void> {
    // Update Jellyfin
    await this.jellyfin.updateItemMetadata(update.itemId, {
      name: update.name,
      overview: update.overview,
      genres: update.genres,
      tags: update.tags,
      studios: update.studios,
      people: update.people,
      providerIds: update.providerIds,
      premiereDate: update.premiereDate,
      endDate: update.endDate,
      productionYear: update.year,
      officialRating: update.officialRating,
      communityRating: update.communityRating,
    });

    // Update local database
    await this.database.item.update({
      where: { jellyfinId: update.itemId },
      data: {
        name: update.name,
        overview: update.overview,
        genres: JSON.stringify(update.genres),
        tags: JSON.stringify(update.tags),
        studios: JSON.stringify(update.studios),
        providerIds: JSON.stringify(update.providerIds),
        premiereDate: update.premiereDate
          ? new Date(update.premiereDate)
          : undefined,
        year: update.year,
        lastSyncAt: new Date(),
      },
    });
  }

  // Artwork operations
  async applyArtworkUpdate(update: ArtworkUpdate): Promise<void> {
    if (update.deleteExisting) {
      await this.jellyfin.deleteArtwork(update.itemId, update.artworkType);
      return;
    }

    if (update.imageData && update.contentType) {
      // Upload new artwork
      await this.jellyfin.uploadArtwork(
        update.itemId,
        update.artworkType,
        update.imageData,
        update.contentType
      );
    } else if (update.url) {
      // Download and upload artwork from URL
      const response = await fetch(update.url);
      if (!response.ok) {
        throw AppError.providerError(
          'HTTP',
          `Failed to download artwork: ${response.statusText}`
        );
      }

      const imageData = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/jpeg';

      await this.jellyfin.uploadArtwork(
        update.itemId,
        update.artworkType,
        imageData,
        contentType
      );
    }

    // Update database to mark artwork as applied
    await this.database.item.update({
      where: { jellyfinId: update.itemId },
      data: {
        hasArtwork: true,
        lastSyncAt: new Date(),
      },
    });
  }

  async bulkApplyArtwork(candidates: ArtworkCandidate[]): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ itemId: string; error: string }>;
  }> {
    let successful = 0;
    let failed = 0;
    const errors: Array<{ itemId: string; error: string }> = [];

    for (const candidate of candidates) {
      try {
        const item = await this.database.item.findUnique({
          where: { id: candidate.itemId },
          select: { jellyfinId: true },
        });

        if (!item) {
          throw new Error('Item not found');
        }

        await this.applyArtworkUpdate({
          itemId: item.jellyfinId,
          artworkType: candidate.type,
          url: candidate.url,
        });

        // Mark candidate as applied
        await this.database.artworkCandidate.update({
          where: { id: candidate.id },
          data: { isApplied: true },
        });

        successful++;
      } catch (error) {
        failed++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push({ itemId: candidate.itemId, error: errorMessage });
      }
    }

    return { successful, failed, errors };
  }

  // Collection operations
  async applyCollectionUpdate(
    update: CollectionUpdate
  ): Promise<string | null> {
    switch (update.operation) {
      case 'create': {
        const newCollection = await this.jellyfin.createCollection(
          update.name,
          update.itemIds
        );

        // Store in local database
        await this.database.collection.create({
          data: {
            name: update.name,
            jellyfinId: newCollection.Id,
            type: 'manual',
          },
        });

        return newCollection.Id;
      }

      case 'update': {
        if (!update.collectionId)
          throw new Error('Collection ID required for update');

        // Clear existing items and add new ones
        const existingItems = await this.jellyfin.getCollections();
        const targetCollection = existingItems.find(
          (c) => c.id === update.collectionId
        );

        if (targetCollection) {
          // This would need to get current items and remove them first
          // For now, just add the new items
          await this.jellyfin.addItemsToCollection(
            update.collectionId,
            update.itemIds
          );
        }
        return update.collectionId;
      }

      case 'delete': {
        if (!update.collectionId)
          throw new Error('Collection ID required for delete');

        await this.jellyfin.deleteCollection(update.collectionId);

        // Remove from local database
        const collectionToDelete = await this.database.collection.findFirst({
          where: { jellyfinId: update.collectionId },
        });

        if (collectionToDelete) {
          await this.database.collection.delete({
            where: { id: collectionToDelete.id },
          });
        }
        return null;
      }

      case 'add_items':
        if (!update.collectionId)
          throw new Error('Collection ID required for add_items');
        await this.jellyfin.addItemsToCollection(
          update.collectionId,
          update.itemIds
        );
        return update.collectionId;

      case 'remove_items':
        if (!update.collectionId)
          throw new Error('Collection ID required for remove_items');
        await this.jellyfin.removeItemsFromCollection(
          update.collectionId,
          update.itemIds
        );
        return update.collectionId;

      default:
        throw new Error(`Unknown collection operation: ${update.operation}`);
    }
  }

  // Helper methods
  private calculateMetadataChanges(
    currentItem: {
      name: string;
      overview?: string | null;
      genres: string;
      tags: string;
      studios: string;
      year?: number | null;
      providerIds: string;
    },
    update: MetadataUpdate
  ): DiffChange[] {
    const changes: DiffChange[] = [];

    if (update.name && update.name !== currentItem.name) {
      changes.push({
        field: 'name',
        oldValue: currentItem.name,
        newValue: update.name,
        conflict: false,
      });
    }

    if (update.overview && update.overview !== currentItem.overview) {
      changes.push({
        field: 'overview',
        oldValue: currentItem.overview,
        newValue: update.overview,
        conflict: false,
      });
    }

    if (update.genres) {
      const currentGenres = JSON.parse(currentItem.genres || '[]');
      if (JSON.stringify(currentGenres) !== JSON.stringify(update.genres)) {
        changes.push({
          field: 'genres',
          oldValue: currentGenres,
          newValue: update.genres,
          conflict: false,
        });
      }
    }

    if (update.year && update.year !== currentItem.year) {
      changes.push({
        field: 'year',
        oldValue: currentItem.year,
        newValue: update.year,
        conflict: false,
      });
    }

    if (update.providerIds) {
      const currentProviderIds = JSON.parse(currentItem.providerIds || '{}');
      const hasChanges = Object.entries(update.providerIds).some(
        ([key, value]) => currentProviderIds[key] !== value
      );

      if (hasChanges) {
        changes.push({
          field: 'providerIds',
          oldValue: currentProviderIds,
          newValue: { ...currentProviderIds, ...update.providerIds },
          conflict: false,
        });
      }
    }

    return changes;
  }

  private generatePreviewWarnings(itemDiffs: ItemDiff[]): string[] {
    const warnings: string[] = [];

    const conflictCount = itemDiffs.filter((d) => d.hasConflicts).length;
    if (conflictCount > 0) {
      warnings.push(
        `${conflictCount} items have potential conflicts that may need manual review`
      );
    }

    const totalChanges = itemDiffs.reduce(
      (sum, d) => sum + d.changes.length,
      0
    );
    if (totalChanges > 100) {
      warnings.push(
        `Large number of changes (${totalChanges}) - consider running in smaller batches`
      );
    }

    return warnings;
  }
}
