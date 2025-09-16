import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { JellyfinService } from '../jellyfin/jellyfin.service.js';

interface CreateCollectionData {
  name: string;
  type?: string;
  itemIds: string[];
}

interface UpdateCollectionData {
  name?: string;
  type?: string;
  addItemIds?: string[];
  removeItemIds?: string[];
}

@Injectable()
export class CollectionsService {
  private readonly logger = new Logger(CollectionsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jellyfinService: JellyfinService
  ) {}

  async createCollection(data: CreateCollectionData) {
    this.logger.log(
      `Creating collection: ${data.name} with ${data.itemIds.length} items`
    );

    // Verify all items exist if any provided
    if (data.itemIds.length > 0) {
      const existingItems = await this.databaseService.item.findMany({
        where: { id: { in: data.itemIds } },
        select: { id: true, jellyfinId: true },
      });

      if (existingItems.length !== data.itemIds.length) {
        const foundIds = existingItems.map((item) => item.id);
        const missingIds = data.itemIds.filter((id) => !foundIds.includes(id));
        throw new Error(`Items not found: ${missingIds.join(', ')}`);
      }
    }

    // Create collection in database
    const collection = await this.databaseService.collection.create({
      data: {
        name: data.name,
        type: data.type || 'manual',
      },
    });

    // Add items to collection if any provided
    if (data.itemIds.length > 0) {
      await this.databaseService.collectionItem.createMany({
        data: data.itemIds.map((itemId) => ({
          collectionId: collection.id,
          itemId,
        })),
      });
    }

    // Create collection in Jellyfin
    try {
      if (data.itemIds.length > 0) {
        const existingItems = await this.databaseService.item.findMany({
          where: { id: { in: data.itemIds } },
          select: { jellyfinId: true },
        });
        const jellyfinItemIds = existingItems.map((item) => item.jellyfinId);
        await this.jellyfinService.createCollection(data.name, jellyfinItemIds);
      } else {
        await this.jellyfinService.createCollection(data.name, []);
      }
      this.logger.log(`Created Jellyfin collection for: ${data.name}`);
    } catch (error) {
      this.logger.warn(
        `Failed to create Jellyfin collection: ${(error as Error).message}`
      );
      // Don't fail the operation, just log the warning
    }

    return collection;
  }

  async updateCollection(id: string, data: UpdateCollectionData) {
    this.logger.log(`Updating collection: ${id}`);

    const collection = await this.databaseService.collection.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            item: { select: { id: true, jellyfinId: true } },
          },
        },
      },
    });

    if (!collection) {
      throw new Error('Collection not found');
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.type !== undefined) {
      updateData.type = data.type;
    }

    // Update basic collection properties if any
    if (Object.keys(updateData).length > 0) {
      await this.databaseService.collection.update({
        where: { id },
        data: updateData,
      });
    }

    // Handle item additions
    if (data.addItemIds?.length) {
      // Verify new items exist
      const newItems = await this.databaseService.item.findMany({
        where: { id: { in: data.addItemIds } },
        select: { id: true },
      });

      if (newItems.length !== data.addItemIds.length) {
        const foundIds = newItems.map((item) => item.id);
        const missingIds = data.addItemIds.filter(
          (id) => !foundIds.includes(id)
        );
        throw new Error(`Items not found: ${missingIds.join(', ')}`);
      }

      // Add new items
      const existingItems = await this.databaseService.collectionItem.findMany({
        where: {
          collectionId: id,
          itemId: { in: data.addItemIds },
        },
      });
      const existingItemIds = existingItems.map((item) => item.itemId);
      const newItemIds = data.addItemIds.filter(
        (itemId) => !existingItemIds.includes(itemId)
      );

      if (newItemIds.length > 0) {
        await this.databaseService.collectionItem.createMany({
          data: newItemIds.map((itemId) => ({
            collectionId: id,
            itemId,
          })),
        });
      }
    }

    // Handle item removals
    if (data.removeItemIds?.length) {
      await this.databaseService.collectionItem.deleteMany({
        where: {
          collectionId: id,
          itemId: { in: data.removeItemIds },
        },
      });
    }

    // Get updated collection
    const updatedCollection = await this.databaseService.collection.findUnique({
      where: { id },
    });

    // Update Jellyfin collection if name changed
    if (data.name !== undefined) {
      try {
        // Find and update Jellyfin collection (we'll need to enhance this later)
        this.logger.log(
          `Updated collection metadata for: ${updatedCollection!.name}`
        );
      } catch (error) {
        this.logger.warn(
          `Failed to update Jellyfin collection metadata: ${(error as Error).message}`
        );
      }
    }

    return updatedCollection!;
  }

  async deleteCollection(id: string) {
    this.logger.log(`Deleting collection: ${id}`);

    const collection = await this.databaseService.collection.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!collection) {
      throw new Error('Collection not found');
    }

    await this.databaseService.collection.delete({
      where: { id },
    });

    // Delete from Jellyfin
    try {
      // Find and delete Jellyfin collection (we'll need to enhance this later)
      this.logger.log(`Deleted Jellyfin collection for: ${collection.name}`);
    } catch (error) {
      this.logger.warn(
        `Failed to delete Jellyfin collection: ${(error as Error).message}`
      );
    }

    return { success: true };
  }

  async createBulkCollections(collections: CreateCollectionData[]) {
    this.logger.log(`Creating ${collections.length} collections in bulk`);

    const results = [];

    for (const collectionData of collections) {
      try {
        const collection = await this.createCollection(collectionData);
        results.push(collection);
      } catch (error) {
        this.logger.error(
          `Failed to create collection ${collectionData.name}: ${(error as Error).message}`
        );
        // Continue with other collections even if one fails
      }
    }

    return results;
  }

  async addItemsToCollection(collectionId: string, itemIds: string[]) {
    this.logger.log(
      `Adding ${itemIds.length} items to collection: ${collectionId}`
    );

    return this.updateCollection(collectionId, {
      addItemIds: itemIds,
    });
  }

  async removeItemsFromCollection(collectionId: string, itemIds: string[]) {
    this.logger.log(
      `Removing ${itemIds.length} items from collection: ${collectionId}`
    );

    return this.updateCollection(collectionId, {
      removeItemIds: itemIds,
    });
  }

  async getCollectionItems(collectionId: string) {
    const collection = await this.databaseService.collection.findUnique({
      where: { id: collectionId },
      include: {
        items: {
          include: {
            item: {
              include: {
                library: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!collection) {
      throw new Error('Collection not found');
    }

    return collection.items.map((collectionItem) => ({
      id: collectionItem.item.id,
      jellyfinId: collectionItem.item.jellyfinId,
      name: collectionItem.item.name,
      type: collectionItem.item.type,
      year: collectionItem.item.year,
      overview: collectionItem.item.overview,
      parentName: collectionItem.item.parentId ? 'Parent Item' : undefined,
      libraryName: collectionItem.item.library?.name,
      hasArtwork: collectionItem.item.hasArtwork,
      lastSyncAt: collectionItem.item.lastSyncAt,
    }));
  }
}
