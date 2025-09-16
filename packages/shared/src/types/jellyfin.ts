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

// Additional Jellyfin API types for HTTP client
export interface JellyfinUser {
  Id: string;
  Name: string;
  ServerId: string;
  ConnectUserName?: string;
  ConnectUserId?: string;
  HasPassword: boolean;
  HasConfiguredPassword: boolean;
  HasConfiguredEasyPassword: boolean;
  EnableAutoLogin?: boolean;
  LastLoginDate?: string;
  LastActivityDate?: string;
}

export interface JellyfinSystemInfo {
  SystemUpdateLevel: string;
  OperatingSystemDisplayName: string;
  HasPendingRestart: boolean;
  IsShuttingDown: boolean;
  SupportsLibraryMonitor: boolean;
  WebSocketPortNumber: number;
  CompletedInstallations: unknown[];
  CanSelfRestart: boolean;
  CanSelfUpdate: boolean;
  CanLaunchWebBrowser: boolean;
  ProgramDataPath: string;
  WebPath: string;
  ItemsByNamePath: string;
  CachePath: string;
  LogPath: string;
  InternalMetadataPath: string;
  TranscodingTempPath: string;
  HttpServerPortNumber: number;
  SupportsHttps: boolean;
  HttpsPortNumber: number;
  HasUpdateAvailable: boolean;
  SupportsAutoRunAtStartup: boolean;
  HardwareAccelerationRequiresPremiere: boolean;
  LocalAddress: string;
  WanAddress: string;
  RemoteAddresses: string[];
  ServerName: string;
  Version: string;
  OperatingSystem: string;
  Id: string;
}

export interface JellyfinLibrary {
  Id: string;
  Name: string;
  CollectionType?: string;
  LocationType: string;
  Locations: string[];
  LibraryOptions?: {
    EnablePhotos: boolean;
    EnableRealtimeMonitor: boolean;
    EnableChapterImageExtraction: boolean;
    ExtractChapterImagesDuringLibraryScan: boolean;
    PathInfos: Array<{
      Path: string;
      NetworkPath?: string;
    }>;
  };
}

export interface JellyfinItemsQuery {
  userId?: string;
  parentId?: string;
  includeItemTypes?: string[];
  excludeItemTypes?: string[];
  recursive?: boolean;
  fields?: string[];
  startIndex?: number;
  limit?: number;
  sortBy?: string[];
  sortOrder?: 'Ascending' | 'Descending';
  filters?: string[];
  searchTerm?: string;
}

export interface JellyfinItemsResponse {
  Items: JellyfinItem[];
  TotalRecordCount: number;
  StartIndex: number;
}
