import { Injectable } from '@nestjs/common';
import { ConfigService } from '../modules/config/config.service.js';
import { LoggerService } from '../modules/logger/logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { JellyfinService } from '../jellyfin/jellyfin.service.js';
import { MisclassificationService } from '../metadata/misclassification.service.js';
import { AppError } from '@metafin/shared';
import { ItemType } from '@metafin/shared';
import type { JellyfinLibrary } from '@metafin/shared';

export interface SyncProgress {
  totalItems: number;
  processedItems: number;
  failedItems: number;
  currentLibrary?: string;
  stage:
    | 'initializing'
    | 'syncing_libraries'
    | 'syncing_items'
    | 'analyzing_misclassifications'
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
    private readonly jellyfin: JellyfinService,
    private readonly misclassification: MisclassificationService
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

      // Stage 1.5: Sync global collections
      this.logger.log('Syncing global collections from Jellyfin', 'LibrarySyncService');
      await this.syncCollections();
      result.librariesSynced++; // Count collections as an additional "library"

      // Stage 2: Sync library items
      this.currentSync.stage = 'syncing_items';
      this.logger.log('Syncing library items', 'LibrarySyncService');

      // First, calculate total items across all libraries
      this.logger.log('Calculating total items across all libraries', 'LibrarySyncService');
      let totalItemsAcrossLibraries = 0;
      for (const library of targetLibraries) {
        if (!this.currentSync) break; // Check for cancellation

        const supportedTypes = this.getSupportedItemTypes(library.CollectionType);
        const countResponse = await this.jellyfin.getItems({
          parentId: library.Id,
          includeItemTypes: supportedTypes,
          recursive: true,
          startIndex: 0,
          limit: 1, // Just get the count, not the items
          fields: [],
        });
        totalItemsAcrossLibraries += countResponse.TotalRecordCount;
      }

      this.currentSync.totalItems = totalItemsAcrossLibraries;
      this.logger.log(`Total items to sync: ${totalItemsAcrossLibraries}`, 'LibrarySyncService');

      // Now sync the libraries
      for (const library of targetLibraries) {
        if (!this.currentSync) break; // Check for cancellation

        this.currentSync.currentLibrary = library.Name;

        // Get the internal library ID from the database
        const jellyfinId = library.Id || (library as any).ItemId;
        const internalLibrary = await this.database.library.findUnique({
          where: { jellyfinId },
          select: { id: true }
        });

        if (!internalLibrary) {
          this.logger.warn(
            `Library not found in database: ${library.Name} (${jellyfinId})`,
            'LibrarySyncService'
          );
          continue;
        }

        const syncStats = await this.syncLibraryItems(
          library,
          internalLibrary.id,
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

      // Stage 3: Analyze misclassifications
      this.currentSync.stage = 'analyzing_misclassifications';
      this.logger.log(
        'Analyzing library for misclassifications',
        'LibrarySyncService'
      );

      const libraryIds = targetLibraries.map((lib) => {
        // Find the internal library ID for each Jellyfin library
        return this.database.library
          .findUnique({
            where: { jellyfinId: lib.Id },
            select: { id: true },
          })
          .then((lib) => lib?.id);
      });

      const resolvedLibraryIds = (await Promise.all(libraryIds)).filter(
        Boolean
      ) as string[];

      for (const libraryId of resolvedLibraryIds) {
        if (!this.currentSync) break; // Check for cancellation

        try {
          await this.misclassification.scanLibraryForMisclassifications(
            libraryId
          );
        } catch (error) {
          this.logger.warn(
            `Failed to analyze misclassifications for library ${libraryId}: ${error}`,
            'LibrarySyncService'
          );
        }
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
    // Handle both VirtualFolders (uses ItemId) and Views (uses Id) response formats
    const jellyfinId = library.Id || (library as any).ItemId;

    if (!jellyfinId) {
      this.logger.warn(
        `Library missing ID field: ${JSON.stringify(library)}`,
        'LibrarySyncService'
      );
      return;
    }

    const existingLibrary = await this.database.library.findUnique({
      where: { jellyfinId },
    });

    const libraryData = {
      jellyfinId,
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
    internalLibraryId: string,
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
          'PrimaryImageAspectRatio',
          'ImageTags',
          'BackdropImageTags',
        ],
      });

      if (response.Items.length === 0) break;

      for (const item of response.Items) {
        try {
          await this.syncItem(item, internalLibraryId);
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

  private async syncItem(item: any, libraryId: string): Promise<void> {
    // Handle raw Jellyfin API response format (capitalized fields)
    const rawType = item.Type || item.type;
    const itemType = this.mapJellyfinItemType(rawType);
    if (!itemType) {
      this.logger.debug(
        `Skipping unsupported item type: ${rawType}`,
        'LibrarySyncService'
      );
      return;
    }

    // Handle both capitalized (raw API) and lowercase (normalized) field names
    const jellyfinId = item.Id || item.id;

    const existingItem = await this.database.item.findUnique({
      where: { jellyfinId },
    });

    const itemData = {
      jellyfinId,
      name: item.Name || item.name,
      type: itemType,
      libraryId: libraryId,
      parentId: item.ParentId || item.parentId,
      path: item.Path || item.path,
      overview: item.Overview || item.overview,
      year: item.ProductionYear || item.year,
      premiereDate: (item.PremiereDate || item.premiereDate) ? new Date(item.PremiereDate || item.premiereDate) : null,
      runTimeTicks: (item.RunTimeTicks || item.runTimeTicks) ? BigInt(item.RunTimeTicks || item.runTimeTicks) : null,
      indexNumber: item.IndexNumber || item.indexNumber,
      parentIndexNumber: item.ParentIndexNumber || item.parentIndexNumber,
      providerIds: JSON.stringify(item.ProviderIds || item.providerIds || {}),
      genres: JSON.stringify(item.Genres || item.genres || []),
      tags: JSON.stringify(item.Tags || item.tags || []),
      studios: JSON.stringify((item.Studios || item.studios || []).map((s: any) => s.Name || s)),
      dateCreated: new Date(item.DateCreated || item.dateCreated),
      dateModified: (item.DateModified || item.dateModified) ? new Date(item.DateModified || item.dateModified) : null,
      hasArtwork: this.hasArtworkImages(item),
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

  private hasArtworkImages(item: any): boolean {
    // Check for common artwork types that indicate the item has artwork
    const artworkFields = [
      'PrimaryImageTag',
      'BackdropImageTags',
      'ImageTags',
      'HasImage'
    ];

    // Check if item has a primary image tag
    if (item.PrimaryImageTag || item.primaryImageTag) {
      return true;
    }

    // Check if item has backdrop images
    if (item.BackdropImageTags && Array.isArray(item.BackdropImageTags) && item.BackdropImageTags.length > 0) {
      return true;
    }

    // Check ImageTags object for any image types
    const imageTags = item.ImageTags || item.imageTags;
    if (imageTags && typeof imageTags === 'object') {
      const imageTypes = Object.keys(imageTags);
      if (imageTypes.length > 0) {
        return true;
      }
    }

    return false;
  }

  private getSupportedItemTypes(collectionType?: string): string[] {
    switch (collectionType) {
      case 'tvshows':
        return ['Series', 'Season', 'Episode'];
      case 'movies':
        return ['Movie'];
      case 'mixed':
        return ['Series', 'Season', 'Episode', 'Movie'];
      case 'boxsets':
        return ['BoxSet'];
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

  private async syncCollections(): Promise<void> {
    try {
      // Get all collections from Jellyfin
      const jellyfinCollections = await this.jellyfin.getCollections();

      this.logger.log(
        `Found ${jellyfinCollections.length} collections in Jellyfin`,
        'LibrarySyncService'
      );

      for (const collection of jellyfinCollections) {
        if (!this.currentSync) break; // Check for cancellation

        try {
          await this.syncCollection(collection);
        } catch (error) {
          this.logger.warn(
            `Failed to sync collection ${collection.Name}: ${error}`,
            'LibrarySyncService'
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to get collections from Jellyfin: ${error}`,
        'LibrarySyncService'
      );
      throw error;
    }
  }

  private async syncCollection(collection: any): Promise<void> {
    const jellyfinId = collection.Id;
    const name = collection.Name;

    if (!jellyfinId || !name) {
      this.logger.warn(
        `Collection missing required fields: ${JSON.stringify(collection)}`,
        'LibrarySyncService'
      );
      return;
    }

    // Check if collection already exists
    const existingCollection = await this.database.collection.findFirst({
      where: { jellyfinId },
    });

    const collectionData = {
      name,
      jellyfinId,
      type: 'jellyfin',
      lastBuiltAt: new Date(),
    };

    let collectionRecord;

    if (existingCollection) {
      collectionRecord = await this.database.collection.update({
        where: { id: existingCollection.id },
        data: collectionData,
      });
      this.logger.debug(
        `Updated collection: ${name}`,
        'LibrarySyncService'
      );
    } else {
      collectionRecord = await this.database.collection.create({
        data: collectionData,
      });
      this.logger.debug(
        `Created collection: ${name}`,
        'LibrarySyncService'
      );
    }

    // Sync collection items
    await this.syncCollectionItems(collection, collectionRecord.id);
  }

  private async syncCollectionItems(collection: any, collectionId: string): Promise<void> {
    try {
      // Get items in this collection from Jellyfin
      const collectionItems = await this.jellyfin.getCollectionItems(collection.Id);

      // Clear existing collection items
      await this.database.collectionItem.deleteMany({
        where: { collectionId },
      });

      // Add current collection items
      for (let i = 0; i < collectionItems.length; i++) {
        const item = collectionItems[i];

        // Find the corresponding item in our database
        const dbItem = await this.database.item.findUnique({
          where: { jellyfinId: item.Id },
        });

        if (dbItem) {
          await this.database.collectionItem.create({
            data: {
              collectionId,
              itemId: dbItem.id,
              sortIndex: i,
            },
          });
        } else {
          this.logger.debug(
            `Collection item ${item.Name} (${item.Id}) not found in database`,
            'LibrarySyncService'
          );
        }
      }

      this.logger.debug(
        `Synced ${collectionItems.length} items for collection ${collection.Name}`,
        'LibrarySyncService'
      );
    } catch (error) {
      this.logger.warn(
        `Failed to sync items for collection ${collection.Name}: ${error}`,
        'LibrarySyncService'
      );
    }
  }

}
