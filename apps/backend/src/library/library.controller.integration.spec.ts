/**
 * Integration test to verify BigInt serialization in library endpoints
 * This test verifies that the library controller properly transforms BigInt values
 */

import { transformItemsForSerialization, transformItemForSerialization } from '../common/utils/serialization.util';

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