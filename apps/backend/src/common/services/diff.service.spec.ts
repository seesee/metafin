import { Test, TestingModule } from '@nestjs/testing';
import { DiffService, CurrentMetadata, ProposedMetadata } from './diff.service';

describe('DiffService', () => {
  let service: DiffService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DiffService],
    }).compile();

    service = module.get<DiffService>(DiffService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('computeMetadataDiff', () => {
    it('should return empty diff for identical metadata (no-op)', () => {
      const current: CurrentMetadata = {
        name: 'Test Movie',
        overview: 'A test movie',
        year: 2023,
        type: 'Movie',
        genres: ['Action', 'Drama'],
        tags: ['test'],
        providerIds: { imdb: 'tt123456' },
      };

      const proposed: ProposedMetadata = {
        name: 'Test Movie',
        overview: 'A test movie',
        year: 2023,
        type: 'Movie',
        genres: ['Action', 'Drama'],
        tags: ['test'],
        providerIds: { imdb: 'tt123456' },
      };

      const diff = service.computeMetadataDiff(current, proposed, 'item-1');

      expect(diff.hasChanges).toBe(false);
      expect(diff.changes).toHaveLength(0);
      expect(service.isNoOp(diff)).toBe(true);
    });

    it('should detect added fields', () => {
      const current: CurrentMetadata = {
        name: 'Test Movie',
      };

      const proposed: ProposedMetadata = {
        name: 'Test Movie',
        overview: 'A new overview',
        year: 2023,
      };

      const diff = service.computeMetadataDiff(current, proposed, 'item-1');

      expect(diff.hasChanges).toBe(true);
      expect(diff.changes).toHaveLength(2);

      const overviewChange = diff.changes.find(c => c.field === 'overview');
      expect(overviewChange).toEqual({
        field: 'overview',
        type: 'added',
        before: undefined,
        after: 'A new overview',
      });

      const yearChange = diff.changes.find(c => c.field === 'year');
      expect(yearChange).toEqual({
        field: 'year',
        type: 'added',
        before: undefined,
        after: 2023,
      });
    });

    it('should detect modified fields', () => {
      const current: CurrentMetadata = {
        name: 'Test Movie',
        overview: 'Old overview',
        year: 2022,
      };

      const proposed: ProposedMetadata = {
        name: 'Updated Movie',
        overview: 'New overview',
        year: 2023,
      };

      const diff = service.computeMetadataDiff(current, proposed, 'item-1');

      expect(diff.hasChanges).toBe(true);
      expect(diff.changes).toHaveLength(3);

      expect(diff.changes).toContainEqual({
        field: 'name',
        type: 'modified',
        before: 'Test Movie',
        after: 'Updated Movie',
      });

      expect(diff.changes).toContainEqual({
        field: 'overview',
        type: 'modified',
        before: 'Old overview',
        after: 'New overview',
      });

      expect(diff.changes).toContainEqual({
        field: 'year',
        type: 'modified',
        before: 2022,
        after: 2023,
      });
    });

    it('should detect removed fields', () => {
      const current: CurrentMetadata = {
        name: 'Test Movie',
        overview: 'An overview',
        year: 2023,
      };

      const proposed: ProposedMetadata = {
        name: 'Test Movie',
      };

      const diff = service.computeMetadataDiff(current, proposed, 'item-1');

      expect(diff.hasChanges).toBe(true);
      expect(diff.changes).toHaveLength(2);

      expect(diff.changes).toContainEqual({
        field: 'overview',
        type: 'removed',
        before: 'An overview',
        after: undefined,
      });

      expect(diff.changes).toContainEqual({
        field: 'year',
        type: 'removed',
        before: 2023,
        after: undefined,
      });
    });

    it('should handle array fields deterministically', () => {
      const current: CurrentMetadata = {
        genres: ['Drama', 'Action', 'Comedy'],
        tags: ['feature', 'award-winner'],
      };

      const proposed: ProposedMetadata = {
        genres: ['Action', 'Comedy', 'Thriller'], // Different order + new genre
        tags: ['award-winner', 'feature'], // Same content, different order
      };

      const diff = service.computeMetadataDiff(current, proposed, 'item-1');

      expect(diff.hasChanges).toBe(true);
      expect(diff.changes).toHaveLength(1); // Only genres should change, tags are the same when sorted

      const genreChange = diff.changes.find(c => c.field === 'genres');
      expect(genreChange?.type).toBe('modified');
      expect(genreChange?.before).toEqual(['Action', 'Comedy', 'Drama']); // Sorted
      expect(genreChange?.after).toEqual(['Action', 'Comedy', 'Thriller']); // Sorted
    });

    it('should handle provider IDs deterministically', () => {
      const current: CurrentMetadata = {
        providerIds: { imdb: 'tt123456', tvdb: '654321' },
      };

      const proposed: ProposedMetadata = {
        providerIds: { tvdb: '654321', imdb: 'tt123456', tmdb: '789012' }, // Same keys different order + new key
      };

      const diff = service.computeMetadataDiff(current, proposed, 'item-1');

      expect(diff.hasChanges).toBe(true);
      expect(diff.changes).toHaveLength(1);

      const providerChange = diff.changes.find(c => c.field === 'providerIds');
      expect(providerChange?.type).toBe('modified');
      // Should be sorted by keys
      expect(providerChange?.before).toEqual({ imdb: 'tt123456', tvdb: '654321' });
      expect(providerChange?.after).toEqual({ imdb: 'tt123456', tmdb: '789012', tvdb: '654321' });
    });

    it('should handle complex array fields (people)', () => {
      const current: CurrentMetadata = {
        people: [
          { name: 'John Doe', role: 'Director', type: 'Director' },
          { name: 'Jane Smith', role: 'Actor', type: 'Actor' },
        ],
      };

      const proposed: ProposedMetadata = {
        people: [
          { name: 'Jane Smith', role: 'Actor', type: 'Actor' }, // Same person, different order
          { name: 'Bob Wilson', role: 'Producer', type: 'Producer' }, // New person
        ],
      };

      const diff = service.computeMetadataDiff(current, proposed, 'item-1');

      expect(diff.hasChanges).toBe(true);
      expect(diff.changes).toHaveLength(1);

      const peopleChange = diff.changes.find(c => c.field === 'people');
      expect(peopleChange?.type).toBe('modified');
      // Should be sorted by name
      expect(peopleChange?.before).toEqual([
        { name: 'Jane Smith', role: 'Actor', type: 'Actor' },
        { name: 'John Doe', role: 'Director', type: 'Director' },
      ]);
      expect(peopleChange?.after).toEqual([
        { name: 'Bob Wilson', role: 'Producer', type: 'Producer' },
        { name: 'Jane Smith', role: 'Actor', type: 'Actor' },
      ]);
    });
  });

  describe('computeBulkDiff', () => {
    it('should compute diffs for multiple items', () => {
      const items = [
        {
          itemId: 'item-1',
          current: { name: 'Movie 1', year: 2020 },
          proposed: { name: 'Movie 1 Updated', year: 2020 },
        },
        {
          itemId: 'item-2',
          current: { name: 'Movie 2', year: 2021 },
          proposed: { name: 'Movie 2', year: 2021 }, // No changes
        },
        {
          itemId: 'item-3',
          current: { name: 'Movie 3' },
          proposed: { name: 'Movie 3', overview: 'New overview' },
        },
      ];

      const diffs = service.computeBulkDiff(items);

      expect(diffs).toHaveLength(3);
      expect(diffs[0].hasChanges).toBe(true);
      expect(diffs[1].hasChanges).toBe(false);
      expect(diffs[2].hasChanges).toBe(true);
    });
  });

  describe('getDiffSummary', () => {
    it('should provide accurate summary statistics', () => {
      const diffs = [
        {
          itemId: 'item-1',
          hasChanges: true,
          changes: [
            { field: 'name', type: 'modified' as const, before: 'Old', after: 'New' },
            { field: 'year', type: 'added' as const, before: undefined, after: 2023 },
          ],
          conflicts: [],
        },
        {
          itemId: 'item-2',
          hasChanges: false,
          changes: [],
          conflicts: [],
        },
        {
          itemId: 'item-3',
          hasChanges: true,
          changes: [
            { field: 'name', type: 'modified' as const, before: 'Old', after: 'New' },
          ],
          conflicts: [
            { field: 'name', type: 'modified' as const, before: 'Old', after: 'New', hasConflict: true },
          ],
        },
      ];

      const summary = service.getDiffSummary(diffs);

      expect(summary).toEqual({
        totalItems: 3,
        itemsWithChanges: 2,
        itemsWithConflicts: 1,
        changesByField: {
          name: 2,
          year: 1,
        },
      });
    });
  });

  describe('deterministic behavior', () => {
    it('should produce identical results for the same input', () => {
      const current: CurrentMetadata = {
        name: 'Test',
        genres: ['Comedy', 'Action', 'Drama'],
        providerIds: { tvdb: '123', imdb: 'tt456', tmdb: '789' },
        people: [
          { name: 'Charlie', role: 'Actor', type: 'Actor' },
          { name: 'Alice', role: 'Director', type: 'Director' },
          { name: 'Bob', role: 'Producer', type: 'Producer' },
        ],
      };

      const proposed: ProposedMetadata = {
        name: 'Test Updated',
        genres: ['Thriller', 'Action'],
        providerIds: { imdb: 'tt456', tvdb: '999' },
        people: [
          { name: 'Alice', role: 'Director', type: 'Director' },
          { name: 'David', role: 'Writer', type: 'Writer' },
        ],
      };

      const diff1 = service.computeMetadataDiff(current, proposed, 'item-1');
      const diff2 = service.computeMetadataDiff(current, proposed, 'item-1');

      expect(diff1).toEqual(diff2);
    });
  });
});