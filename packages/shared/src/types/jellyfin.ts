export enum ItemType {
  Series = 'Series',
  Season = 'Season',
  Episode = 'Episode',
  Movie = 'Movie',
  Collection = 'BoxSet',
}

export enum ArtworkType {
  Primary = 'Primary',
  Backdrop = 'Backdrop',
  Thumb = 'Thumb',
  Logo = 'Logo',
  Banner = 'Banner',
}

export interface ProviderIdMap {
  tvdb?: string;
  tmdb?: string;
  imdb?: string;
  tvmaze?: string;
  wikidata?: string;
  [key: string]: string | undefined;
}

export interface JellyfinItem {
  id: string;
  name: string;
  type: ItemType;
  overview?: string;
  parentId?: string;
  libraryId: string;
  path?: string;
  dateCreated: string;
  dateModified?: string;
  year?: number;
  premiereDate?: string;
  endDate?: string;
  runTimeTicks?: number;
  indexNumber?: number;
  parentIndexNumber?: number;
  providerIds: ProviderIdMap;
  genres: string[];
  tags: string[];
  people: PersonInfo[];
  studios: string[];
  hasArtwork: boolean;
  imageBlurHashes?: Record<ArtworkType, string>;
}

export interface PersonInfo {
  name: string;
  role?: string;
  type: PersonType;
  id?: string;
}

export enum PersonType {
  Actor = 'Actor',
  Director = 'Director',
  Writer = 'Writer',
  Producer = 'Producer',
  Composer = 'Composer',
  GuestStar = 'GuestStar',
}

export interface LibraryInfo {
  id: string;
  name: string;
  type: string;
  locations: string[];
  refreshProgress?: number;
}

export interface ArtworkCandidate {
  type: ArtworkType;
  url: string;
  width?: number;
  height?: number;
  language?: string;
  source: string;
  confidence: number;
}

export interface CollectionRule {
  field: string;
  operator:
    | 'equals'
    | 'contains'
    | 'startsWith'
    | 'endsWith'
    | 'regex'
    | 'exists'
    | 'greaterThan'
    | 'lessThan';
  value?: string | number | boolean;
  caseSensitive?: boolean;
}

export interface SmartCollection {
  id?: string;
  name: string;
  rules: CollectionRule[];
  operator: 'and' | 'or';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

export enum JobStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export interface JobInfo {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  startTime?: string;
  endTime?: string;
  errorMessage?: string;
  itemsTotal: number;
  itemsProcessed: number;
  itemsFailed: number;
}

export interface DiffChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  conflict: boolean;
}

export interface ItemDiff {
  itemId: string;
  changes: DiffChange[];
  hasConflicts: boolean;
  apiCallCount: number;
}

export interface BulkOperationPreview {
  itemDiffs: ItemDiff[];
  totalApiCalls: number;
  estimatedDuration: number;
  warnings: string[];
}
