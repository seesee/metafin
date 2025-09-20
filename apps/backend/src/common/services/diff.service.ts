import { Injectable } from '@nestjs/common';

export interface MetadataDiff {
  field: string;
  type: 'added' | 'modified' | 'removed' | 'unchanged';
  before: unknown;
  after: unknown;
  hasConflict?: boolean;
  conflictReason?: string;
}

export interface ItemDiff {
  itemId: string;
  hasChanges: boolean;
  changes: MetadataDiff[];
  conflicts: MetadataDiff[];
}

export interface CurrentMetadata {
  name?: string;
  overview?: string;
  year?: number;
  type?: 'Series' | 'Season' | 'Episode' | 'Movie';
  genres?: string[];
  tags?: string[];
  studios?: string[];
  providerIds?: Record<string, string>;
  premiereDate?: string;
  endDate?: string;
  officialRating?: string;
  communityRating?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  people?: Array<{ name: string; role?: string; type: string }>;
  artwork?: {
    primary?: string;
    backdrop?: string;
    logo?: string;
    banner?: string;
  };
  collections?: string[];
}

export interface ProposedMetadata extends CurrentMetadata {
  // Same structure as current metadata
}

@Injectable()
export class DiffService {
  /**
   * Computes the diff between current and proposed metadata
   * Returns deterministic diffs with conflict detection
   */
  computeMetadataDiff(
    current: CurrentMetadata,
    proposed: ProposedMetadata,
    itemId: string,
  ): ItemDiff {
    const changes: MetadataDiff[] = [];
    const conflicts: MetadataDiff[] = [];

    // Compare each metadata field
    this.compareField('name', current.name, proposed.name, changes);
    this.compareField('overview', current.overview, proposed.overview, changes);
    this.compareField('year', current.year, proposed.year, changes);
    this.compareField('type', current.type, proposed.type, changes);
    this.compareField('premiereDate', current.premiereDate, proposed.premiereDate, changes);
    this.compareField('endDate', current.endDate, proposed.endDate, changes);
    this.compareField('officialRating', current.officialRating, proposed.officialRating, changes);
    this.compareField('communityRating', current.communityRating, proposed.communityRating, changes);
    this.compareField('seasonNumber', current.seasonNumber, proposed.seasonNumber, changes);
    this.compareField('episodeNumber', current.episodeNumber, proposed.episodeNumber, changes);

    // Compare array fields
    this.compareArrayField('genres', current.genres, proposed.genres, changes);
    this.compareArrayField('tags', current.tags, proposed.tags, changes);
    this.compareArrayField('studios', current.studios, proposed.studios, changes);
    this.compareArrayField('collections', current.collections, proposed.collections, changes);

    // Compare object fields
    this.compareObjectField('providerIds', current.providerIds, proposed.providerIds, changes);
    this.compareObjectField('artwork', current.artwork, proposed.artwork, changes);

    // Compare complex array fields
    this.compareComplexArrayField('people', current.people, proposed.people, changes);

    // Filter out unchanged fields and identify conflicts
    const actualChanges = changes.filter(change => change.type !== 'unchanged');
    const conflictChanges = actualChanges.filter(change => change.hasConflict);

    return {
      itemId,
      hasChanges: actualChanges.length > 0,
      changes: actualChanges,
      conflicts: conflictChanges,
    };
  }

  /**
   * Computes diffs for multiple items
   */
  computeBulkDiff(
    items: Array<{ itemId: string; current: CurrentMetadata; proposed: ProposedMetadata }>,
  ): ItemDiff[] {
    return items.map(item =>
      this.computeMetadataDiff(item.current, item.proposed, item.itemId)
    );
  }

  /**
   * Checks if a diff represents a no-op (no changes)
   */
  isNoOp(diff: ItemDiff): boolean {
    return !diff.hasChanges;
  }

  /**
   * Gets a summary of changes across multiple diffs
   */
  getDiffSummary(diffs: ItemDiff[]): {
    totalItems: number;
    itemsWithChanges: number;
    itemsWithConflicts: number;
    changesByField: Record<string, number>;
  } {
    const summary = {
      totalItems: diffs.length,
      itemsWithChanges: diffs.filter(d => d.hasChanges).length,
      itemsWithConflicts: diffs.filter(d => d.conflicts.length > 0).length,
      changesByField: {} as Record<string, number>,
    };

    // Count changes by field
    diffs.forEach(diff => {
      diff.changes.forEach(change => {
        summary.changesByField[change.field] = (summary.changesByField[change.field] || 0) + 1;
      });
    });

    return summary;
  }

  private compareField(
    fieldName: string,
    current: unknown,
    proposed: unknown,
    changes: MetadataDiff[],
  ): void {
    const isEqual = this.deepEqual(current, proposed);

    if (isEqual) {
      changes.push({
        field: fieldName,
        type: 'unchanged',
        before: current,
        after: proposed,
      });
      return;
    }

    let type: 'added' | 'modified' | 'removed';
    if (current === undefined || current === null) {
      type = 'added';
    } else if (proposed === undefined || proposed === null) {
      type = 'removed';
    } else {
      type = 'modified';
    }

    changes.push({
      field: fieldName,
      type,
      before: current,
      after: proposed,
    });
  }

  private compareArrayField(
    fieldName: string,
    current: string[] | undefined,
    proposed: string[] | undefined,
    changes: MetadataDiff[],
  ): void {
    const currentSorted = current ? [...current].sort() : [];
    const proposedSorted = proposed ? [...proposed].sort() : [];

    this.compareField(fieldName, currentSorted, proposedSorted, changes);
  }

  private compareObjectField(
    fieldName: string,
    current: Record<string, unknown> | undefined,
    proposed: Record<string, unknown> | undefined,
    changes: MetadataDiff[],
  ): void {
    // For objects, we need to ensure consistent key ordering for deterministic comparison
    const currentSorted = current ? this.sortObjectKeys(current) : undefined;
    const proposedSorted = proposed ? this.sortObjectKeys(proposed) : undefined;

    this.compareField(fieldName, currentSorted, proposedSorted, changes);
  }

  private compareComplexArrayField(
    fieldName: string,
    current: Array<{ name: string; role?: string; type: string }> | undefined,
    proposed: Array<{ name: string; role?: string; type: string }> | undefined,
    changes: MetadataDiff[],
  ): void {
    // Sort complex arrays by name for deterministic comparison
    const currentSorted = current
      ? [...current].sort((a, b) => a.name.localeCompare(b.name))
      : [];
    const proposedSorted = proposed
      ? [...proposed].sort((a, b) => a.name.localeCompare(b.name))
      : [];

    this.compareField(fieldName, currentSorted, proposedSorted, changes);
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;

    if (a == null || b == null) return a === b;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => this.deepEqual(item, b[index]));
    }

    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a as object);
      const keysB = Object.keys(b as object);

      if (keysA.length !== keysB.length) return false;

      return keysA.every(key =>
        keysB.includes(key) &&
        this.deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
      );
    }

    return false;
  }

  private sortObjectKeys(obj: Record<string, unknown>): Record<string, unknown> {
    const sorted: Record<string, unknown> = {};
    Object.keys(obj)
      .sort()
      .forEach(key => {
        sorted[key] = obj[key];
      });
    return sorted;
  }
}