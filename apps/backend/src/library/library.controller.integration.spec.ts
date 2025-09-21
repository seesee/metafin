/**
 * Integration test to verify BigInt serialization in library endpoints and collection sync functionality
 * This test verifies that the library controller properly transforms BigInt values and collection sync works
 */

import { Test, TestingModule } from '@nestjs/testing';
import { LibraryController } from './library.controller.js';
import { LibrarySyncService } from './library-sync.service.js';
import { JellyfinService } from '../jellyfin/jellyfin.service.js';
import { DatabaseModule } from '../database/database.module.js';
import { DatabaseService } from '../database/database.service.js';
import { ConfigModule } from '@nestjs/config';
import { transformItemsForSerialization, transformItemForSerialization } from '../common/utils/serialization.util.js';

describe('Library Controller BigInt Integration', () => {
  it('should handle BigInt serialization in library items response', () => {
    // Mock response structure that would come from Prisma
    const mockItems = [
      {
        id: 'item-1',
        jellyfinId: 'jellyfin-1',
        name: 'Test Movie',
        type: 'Movie',
        overview: 'A test movie',
        parentId: null,
        libraryId: 'lib-1',
        path: '/media/movies/test.mkv',
        pathHash: 'hash123',
        dateCreated: new Date('2023-01-01'),
        dateModified: new Date('2023-01-02'),
        year: 2023,
        premiereDate: new Date('2023-06-01'),
        endDate: null,
        runTimeTicks: BigInt('72000000000'), // 2 hours in 100ns ticks
        runtimeMins: 120,
        indexNumber: null,
        parentIndexNumber: null,
        providerIds: '{"tmdb":"12345"}',
        genres: '["Action", "Adventure"]',
        tags: '["HD", "4K"]',
        studios: '["Test Studio"]',
        hasArtwork: true,
        imageBlurHashes: null,
        suspectedMisclassification: false,
        misclassificationScore: null,
        misclassificationReasons: null,
        lastSyncAt: new Date('2023-12-01'),
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-12-01'),
        library: {
          name: 'Movies'
        }
      }
    ];

    // Transform the response as the controller would
    const transformedItems = transformItemsForSerialization(mockItems);

    // Verify that BigInt is converted to string
    expect(typeof transformedItems[0].runTimeTicks).toBe('string');
    expect(transformedItems[0].runTimeTicks).toBe('72000000000');

    // Verify that JSON serialization works
    expect(() => JSON.stringify(transformedItems)).not.toThrow();

    const serialized = JSON.stringify(transformedItems);
    expect(serialized).toContain('"runTimeTicks":"72000000000"');
  });

  it('should handle BigInt serialization in single library item response', () => {
    const mockItem = {
      id: 'item-1',
      jellyfinId: 'jellyfin-1',
      name: 'Test Series',
      type: 'Series',
      overview: 'A test series',
      runTimeTicks: BigInt('43200000000'), // 1.2 hours in 100ns ticks
      runtimeMins: 72,
      year: 2023,
      hasArtwork: true,
      lastSyncAt: new Date('2023-12-01'),
      library: {
        name: 'TV Shows'
      }
    };

    // Transform the response as the controller would
    const transformedItem = transformItemForSerialization(mockItem);

    // Verify that BigInt is converted to string
    expect(typeof transformedItem.runTimeTicks).toBe('string');
    expect(transformedItem.runTimeTicks).toBe('43200000000');

    // Verify that JSON serialization works
    expect(() => JSON.stringify(transformedItem)).not.toThrow();

    const serialized = JSON.stringify(transformedItem);
    expect(serialized).toContain('"runTimeTicks":"43200000000"');
  });

  it('should handle null runTimeTicks in library items', () => {
    const mockItems = [
      {
        id: 'item-1',
        name: 'Test Item',
        runTimeTicks: null,
        type: 'Episode',
        library: { name: 'TV Shows' }
      }
    ];

    const transformedItems = transformItemsForSerialization(mockItems);

    expect(transformedItems[0].runTimeTicks).toBe(null);
    expect(() => JSON.stringify(transformedItems)).not.toThrow();
  });

  it('should create a proper API response structure', () => {
    const mockItems = [
      {
        id: 'item-1',
        name: 'Test Movie',
        runTimeTicks: BigInt('72000000000'),
        type: 'Movie',
        library: { name: 'Movies' }
      }
    ];

    // Simulate the controller response structure
    const apiResponse = {
      items: transformItemsForSerialization(mockItems),
      pagination: {
        page: 1,
        limit: 24,
        total: 1,
        totalPages: 1,
      },
    };

    // Verify the entire response can be serialized
    expect(() => JSON.stringify(apiResponse)).not.toThrow();

    const serialized = JSON.stringify(apiResponse);
    const parsed = JSON.parse(serialized);

    expect(parsed.items[0].runTimeTicks).toBe('72000000000');
    expect(parsed.pagination.total).toBe(1);
  });
});

describe('Collection Sync Integration', () => {
  let controller: LibraryController;
  let syncService: LibrarySyncService;
  let jellyfinService: JellyfinService;
  let database: DatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env.test', '.env'],
        }),
        DatabaseModule,
      ],
      controllers: [LibraryController],
      providers: [LibrarySyncService, JellyfinService],
    }).compile();

    controller = module.get<LibraryController>(LibraryController);
    syncService = module.get<LibrarySyncService>(LibrarySyncService);
    jellyfinService = module.get<JellyfinService>(JellyfinService);
    database = module.get<DatabaseService>(DatabaseService);
  });

  describe('Collection API Calls', () => {
    it('should get collections from Jellyfin API', async () => {
      console.log('Testing direct Jellyfin API calls...');

      try {
        // Test direct API call to get collections
        const collections = await jellyfinService.getCollections();
        console.log(`Found ${collections.length} collections from Jellyfin API`);

        if (collections.length > 0) {
          console.log('First collection structure:', JSON.stringify(collections[0], null, 2));

          // Test getting items for the first collection
          const collectionId = (collections[0] as any).Id || collections[0].id;
          if (collectionId) {
            const collectionItems = await jellyfinService.getCollectionItems(collectionId);
            console.log(`Collection "${(collections[0] as any).Name || collections[0].name}" has ${collectionItems.length} items`);

            if (collectionItems.length > 0) {
              console.log('First collection item structure:', JSON.stringify(collectionItems[0], null, 2));
            }
          }
        }

        expect(collections).toBeDefined();
        expect(Array.isArray(collections)).toBe(true);
      } catch (error) {
        console.error('Error testing Jellyfin API calls:', error);
        throw error;
      }
    }, 30000);

    it('should check database collections before sync', async () => {
      console.log('Checking database collections before sync...');

      const collectionsInDb = await database.collection.count();
      const collectionItemsInDb = await database.collectionItem.count();

      console.log(`Collections in database: ${collectionsInDb}`);
      console.log(`Collection items in database: ${collectionItemsInDb}`);

      if (collectionsInDb > 0) {
        const sampleCollections = await database.collection.findMany({
          take: 3,
          include: {
            items: {
              include: {
                item: {
                  select: {
                    name: true,
                    jellyfinId: true,
                    type: true,
                  },
                },
              },
            },
          },
        });

        console.log('Sample collections with items:', JSON.stringify(sampleCollections, null, 2));
      }
    }, 30000);

    it('should test collection sync methods individually', async () => {
      console.log('Testing collection sync methods...');

      try {
        // Get collections from Jellyfin
        const collections = await jellyfinService.getCollections();
        console.log(`Got ${collections.length} collections from Jellyfin`);

        if (collections.length > 0) {
          const firstCollection = collections[0];
          const collectionId = (firstCollection as any).Id || firstCollection.id;
          const collectionName = (firstCollection as any).Name || firstCollection.name;

          console.log(`Testing sync for collection: "${collectionName}" (${collectionId})`);

          // Check if items exist in database first
          const totalItems = await database.item.count();
          console.log(`Total items in database: ${totalItems}`);

          if (totalItems === 0) {
            console.log('No items in database - need to sync library items first');
          } else {
            // Get collection items from Jellyfin
            const collectionItems = await jellyfinService.getCollectionItems(collectionId);
            console.log(`Collection has ${collectionItems.length} items in Jellyfin`);

            // Check how many of these items exist in our database
            let foundInDb = 0;
            for (const item of collectionItems) {
              const itemId = (item as any).Id || item.id;
              const dbItem = await database.item.findUnique({
                where: { jellyfinId: itemId },
              });
              if (dbItem) {
                foundInDb++;
              } else {
                console.log(`Item not found in database: "${(item as any).Name || item.name}" (${itemId})`);
              }
            }

            console.log(`${foundInDb}/${collectionItems.length} collection items found in database`);
          }
        }
      } catch (error) {
        console.error('Error testing collection sync methods:', error);
        throw error;
      }
    }, 60000);

    it('should perform full collection sync test', async () => {
      console.log('Performing full collection sync test...');

      try {
        // First ensure we have some items in the database
        const itemCount = await database.item.count();
        console.log(`Items in database before sync: ${itemCount}`);

        if (itemCount === 0) {
          console.log('Triggering library sync to populate items first...');
          const syncResult = await controller.startSync({ fullSync: true });
          console.log('Library sync result:', syncResult);

          const newItemCount = await database.item.count();
          console.log(`Items in database after library sync: ${newItemCount}`);
        }

        // Now test collection sync specifically
        console.log('Testing collection sync...');

        // Count collections before sync
        const collectionsBefore = await database.collection.count();
        const collectionItemsBefore = await database.collectionItem.count();

        console.log(`Collections before sync: ${collectionsBefore}`);
        console.log(`Collection items before sync: ${collectionItemsBefore}`);

        // Run collection sync (using the private method through reflection)
        await (syncService as any).syncCollections();

        // Count collections after sync
        const collectionsAfter = await database.collection.count();
        const collectionItemsAfter = await database.collectionItem.count();

        console.log(`Collections after sync: ${collectionsAfter}`);
        console.log(`Collection items after sync: ${collectionItemsAfter}`);

        // Get sample data to verify structure
        if (collectionsAfter > 0) {
          const sampleCollections = await database.collection.findMany({
            take: 3,
            include: {
              items: {
                include: {
                  item: {
                    select: {
                      name: true,
                      jellyfinId: true,
                      type: true,
                    },
                  },
                },
              },
            },
          });

          console.log('Sample collections after sync:', JSON.stringify(sampleCollections, null, 2));

          // Verify that collections have items
          for (const collection of sampleCollections) {
            console.log(`Collection "${collection.name}" has ${collection.items.length} items`);
          }
        }

        expect(collectionsAfter).toBeGreaterThanOrEqual(collectionsBefore);

      } catch (error) {
        console.error('Error performing full collection sync test:', error);
        throw error;
      }
    }, 120000);
  });
});