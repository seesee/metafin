import { Injectable } from '@nestjs/common';
import { ConfigService } from '../modules/config/config.service.js';
import { LoggerService } from '../modules/logger/logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { JellyfinService } from '../jellyfin/jellyfin.service.js';
import { AppError } from '@metafin/shared';
import { ItemType } from '@metafin/shared';
import type { JellyfinLibrary, JellyfinItem } from '@metafin/shared';

export interface SyncProgress {
  totalItems: number;
  processedItems: number;
  failedItems: number;
  currentLibrary?: string;
  stage:
    | 'initializing'
    | 'syncing_libraries'
    | 'syncing_items'
    | 'completed'
    | 'failed';
  startTime: Date;
  estimatedEndTime?: Date;
}

export interface SyncResult {
  success: boolean;
  librariesSynced: number;
  itemsAdded: number;
  itemsUpdated: number;
  itemsDeleted: number;
  errors: string[];
  duration: number;
}

@Injectable()
export class LibrarySyncService {
  private currentSync: SyncProgress | null = null;
  private readonly requestId = 'library-sync';

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly database: DatabaseService,
    private readonly jellyfin: JellyfinService
  ) {}

  async startSync(
    options: {
      fullSync?: boolean;
      libraryIds?: string[];
    } = {}
  ): Promise<void> {
    if (this.currentSync) {
      throw AppError.conflict(
        'Library sync already in progress',
        { stage: this.currentSync.stage },
        this.requestId
      );
    }

    if (!this.config.hasJellyfinConfig) {
      throw AppError.config(
        'Jellyfin configuration required for library sync',
        { jellyfinConfigured: false }
      );
    }

    this.currentSync = {
      totalItems: 0,
      processedItems: 0,
      failedItems: 0,
      stage: 'initializing',
      startTime: new Date(),
    };

    this.logger.log(
      `Starting library sync (full=${options.fullSync}, libraries=${options.libraryIds?.join(',') || 'all'})`,
      'LibrarySyncService'
    );

    // Start sync in background
    this.performSync(options).catch((error) => {
      this.logger.error(
        `Library sync failed: ${error}`,
        error instanceof Error ? error.stack : undefined,
        'LibrarySyncService'
      );
      if (this.currentSync) {
        this.currentSync.stage = 'failed';
      }
    });
  }

  getSyncProgress(): SyncProgress | null {
    return this.currentSync;
  }

  async cancelSync(): Promise<void> {
    if (!this.currentSync) {
      throw AppError.notFound('No sync in progress');
    }

    this.logger.log('Cancelling library sync', 'LibrarySyncService');
    this.currentSync = null;
  }

  private async performSync(options: {
    fullSync?: boolean;
    libraryIds?: string[];
  }): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      librariesSynced: 0,
      itemsAdded: 0,
      itemsUpdated: 0,
      itemsDeleted: 0,
      errors: [],
      duration: 0,
    };

    try {
      if (!this.currentSync) return result;

      // Stage 1: Sync libraries
      this.currentSync.stage = 'syncing_libraries';
      this.logger.log('Syncing libraries from Jellyfin', 'LibrarySyncService');

      const jellyfinLibraries = await this.jellyfin.getLibraries();
      const targetLibraries = options.libraryIds
        ? jellyfinLibraries.filter((lib) =>
            options.libraryIds!.includes(lib.Id)
          )
        : jellyfinLibraries;

      for (const library of targetLibraries) {
        await this.syncLibrary(library);
        result.librariesSynced++;
      }

      // Stage 2: Sync library items
      this.currentSync.stage = 'syncing_items';
      this.logger.log('Syncing library items', 'LibrarySyncService');

      for (const library of targetLibraries) {
        if (!this.currentSync) break; // Check for cancellation

        this.currentSync.currentLibrary = library.Name;
        const syncStats = await this.syncLibraryItems(
          library,
          options.fullSync || false
        );

        result.itemsAdded += syncStats.added;
        result.itemsUpdated += syncStats.updated;
        result.itemsDeleted += syncStats.deleted;
      }

      // Clean up orphaned items if doing a full sync
      if (options.fullSync) {
        const deletedCount = await this.cleanupOrphanedItems();
        result.itemsDeleted += deletedCount;
      }

      this.currentSync.stage = 'completed';
      result.success = true;

      this.logger.log(
        `Library sync completed: ${result.librariesSynced} libraries, +${result.itemsAdded} -${result.itemsDeleted} ~${result.itemsUpdated} items`,
        'LibrarySyncService'
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);

      this.logger.error(
        `Library sync failed: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
        'LibrarySyncService'
      );

      if (this.currentSync) {
        this.currentSync.stage = 'failed';
      }
    } finally {
      result.duration = Date.now() - startTime;

      // Clear sync state after a delay to allow status checks
      setTimeout(() => {
        this.currentSync = null;
      }, 30000); // Keep status for 30 seconds
    }

    return result;
  }

  private async syncLibrary(library: JellyfinLibrary): Promise<void> {
    const existingLibrary = await this.database.library.findUnique({
      where: { jellyfinId: library.Id },
    });

    const libraryData = {
      jellyfinId: library.Id,
      name: library.Name,
      type: library.CollectionType || 'unknown',
      locations: JSON.stringify(library.Locations || []),
      lastSyncAt: new Date(),
    };

    if (existingLibrary) {
      await this.database.library.update({
        where: { id: existingLibrary.id },
        data: libraryData,
      });
      this.logger.debug(
        `Updated library: ${library.Name}`,
        'LibrarySyncService'
      );
    } else {
      await this.database.library.create({
        data: libraryData,
      });
      this.logger.debug(`Added library: ${library.Name}`, 'LibrarySyncService');
    }
  }

  private async syncLibraryItems(
    library: JellyfinLibrary,
    _fullSync: boolean
  ): Promise<{ added: number; updated: number; deleted: number }> {
    const stats = { added: 0, updated: 0, deleted: 0 };
    let startIndex = 0;
    const limit = 100;

    // Get supported item types for this library
    const supportedTypes = this.getSupportedItemTypes(library.CollectionType);

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (!this.currentSync) break; // Check for cancellation

      const response = await this.jellyfin.getItems({
        parentId: library.Id,
        includeItemTypes: supportedTypes,
        recursive: true,
        startIndex,
        limit,
        fields: [
          'ProviderIds',
          'Genres',
          'People',
          'Studios',
          'DateCreated',
          'DateLastMediaAdded',
          'Overview',
          'Path',
        ],
      });

      if (response.Items.length === 0) break;

      // Update progress
      if (this.currentSync.totalItems === 0) {
        this.currentSync.totalItems = response.TotalRecordCount;
      }

      for (const item of response.Items) {
        try {
          await this.syncItem(item, library.Id);
          stats.added++; // This would need more logic to differentiate add/update
          this.currentSync.processedItems++;
        } catch (error) {
          this.currentSync.failedItems++;
          this.logger.warn(
            `Failed to sync item ${item.name}: ${error}`,
            'LibrarySyncService'
          );
        }
      }

      startIndex += limit;

      // Update estimated completion time
      this.updateEstimatedEndTime();

      if (startIndex >= response.TotalRecordCount) break;
    }

    return stats;
  }

  private async syncItem(item: JellyfinItem, libraryId: string): Promise<void> {
    // Convert Jellyfin item types to our internal types
    const itemType = this.mapJellyfinItemType(item.type);
    if (!itemType) {
      this.logger.debug(
        `Skipping unsupported item type: ${item.type}`,
        'LibrarySyncService'
      );
      return;
    }

    const existingItem = await this.database.item.findUnique({
      where: { jellyfinId: item.id },
    });

    const itemData = {
      jellyfinId: item.id,
      name: item.name,
      type: itemType,
      libraryId: libraryId,
      parentId: item.parentId,
      path: item.path,
      overview: item.overview,
      year: item.year,
      premiereDate: item.premiereDate ? new Date(item.premiereDate) : null,
      runTimeTicks: item.runTimeTicks ? BigInt(item.runTimeTicks) : null,
      indexNumber: item.indexNumber,
      parentIndexNumber: item.parentIndexNumber,
      providerIds: JSON.stringify(item.providerIds || {}),
      genres: JSON.stringify(item.genres || []),
      tags: JSON.stringify(item.tags || []),
      studios: JSON.stringify(item.studios || []),
      dateCreated: new Date(item.dateCreated),
      dateModified: item.dateModified ? new Date(item.dateModified) : null,
      lastSyncAt: new Date(),
    };

    if (existingItem) {
      await this.database.item.update({
        where: { id: existingItem.id },
        data: itemData,
      });
    } else {
      await this.database.item.create({
        data: itemData,
      });
    }
  }

  private getSupportedItemTypes(collectionType?: string): string[] {
    switch (collectionType) {
      case 'tvshows':
        return ['Series', 'Season', 'Episode'];
      case 'movies':
        return ['Movie'];
      case 'mixed':
        return ['Series', 'Season', 'Episode', 'Movie'];
      default:
        return ['Series', 'Season', 'Episode', 'Movie'];
    }
  }

  private mapJellyfinItemType(jellyfinType: string): ItemType | null {
    switch (jellyfinType) {
      case 'Series':
        return ItemType.Series;
      case 'Season':
        return ItemType.Season;
      case 'Episode':
        return ItemType.Episode;
      case 'Movie':
        return ItemType.Movie;
      case 'BoxSet':
        return ItemType.Collection;
      default:
        return null;
    }
  }

  private async cleanupOrphanedItems(): Promise<number> {
    // Delete items that no longer exist in Jellyfin
    // This would require tracking which items we've seen in this sync
    // For now, we'll skip this complex operation
    this.logger.debug(
      'Orphaned item cleanup not yet implemented',
      'LibrarySyncService'
    );
    return 0;
  }

  private updateEstimatedEndTime(): void {
    if (!this.currentSync || this.currentSync.processedItems === 0) return;

    const elapsed = Date.now() - this.currentSync.startTime.getTime();
    const rate = this.currentSync.processedItems / elapsed;
    const remaining =
      this.currentSync.totalItems - this.currentSync.processedItems;
    const estimatedRemainingMs = remaining / rate;

    this.currentSync.estimatedEndTime = new Date(
      Date.now() + estimatedRemainingMs
    );
  }
}
