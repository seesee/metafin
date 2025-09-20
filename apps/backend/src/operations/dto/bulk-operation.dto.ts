import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum OperationType {
  UPDATE_METADATA = 'update-metadata',
  SET_PROVIDER_IDS = 'set-provider-ids',
  ASSIGN_ARTWORK = 'assign-artwork',
  ADD_TO_COLLECTION = 'add-to-collection',
  REMOVE_FROM_COLLECTION = 'remove-from-collection',
}

export enum ScopeType {
  SPECIFIC_ITEMS = 'specific-items',
  LIBRARY_FILTER = 'library-filter',
  SEARCH_QUERY = 'search-query',
}

export class ItemScope {
  @ApiProperty({ enum: ScopeType })
  @IsEnum(ScopeType)
  type: ScopeType;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  itemIds?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  libraryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  searchQuery?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  itemType?: 'Series' | 'Season' | 'Episode' | 'Movie';
}

export class MetadataChanges {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  overview?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  year?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  type?: 'Series' | 'Season' | 'Episode' | 'Movie';

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  studios?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  providerIds?: Record<string, string>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  premiereDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  officialRating?: string;
}

export class BulkOperationRequest {
  @ApiProperty({ enum: OperationType })
  @IsEnum(OperationType)
  operation: OperationType;

  @ApiProperty({ type: ItemScope })
  @ValidateNested()
  @Type(() => ItemScope)
  scope: ItemScope;

  @ApiProperty({ required: false, type: MetadataChanges })
  @IsOptional()
  @ValidateNested()
  @Type(() => MetadataChanges)
  changes?: MetadataChanges;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  collectionId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  artworkAssignments?: Record<string, string>; // itemId -> artworkCandidateId
}

export class OperationPreviewResponse {
  @ApiProperty()
  previewToken: string;

  @ApiProperty()
  totalItems: number;

  @ApiProperty()
  estimatedApiCalls: number;

  @ApiProperty()
  changes: ItemDiff[];

  @ApiProperty()
  summary: DiffSummary;
}

export class ItemDiff {
  @ApiProperty()
  itemId: string;

  @ApiProperty()
  itemName: string;

  @ApiProperty()
  hasChanges: boolean;

  @ApiProperty()
  changes: MetadataChange[];

  @ApiProperty()
  conflicts: MetadataChange[];
}

export class MetadataChange {
  @ApiProperty()
  field: string;

  @ApiProperty({ enum: ['added', 'modified', 'removed'] })
  type: 'added' | 'modified' | 'removed';

  @ApiProperty()
  before: unknown;

  @ApiProperty()
  after: unknown;

  @ApiProperty({ required: false })
  hasConflict?: boolean;

  @ApiProperty({ required: false })
  conflictReason?: string;
}

export class DiffSummary {
  @ApiProperty()
  totalItems: number;

  @ApiProperty()
  itemsWithChanges: number;

  @ApiProperty()
  itemsWithConflicts: number;

  @ApiProperty()
  changesByField: Record<string, number>;
}

export class ExecuteOperationRequest {
  @ApiProperty()
  @IsString()
  previewToken: string;
}

export class ExecuteOperationResponse {
  @ApiProperty()
  jobId: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  estimatedDuration?: string;
}

export class JobStatusResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  type: string;

  @ApiProperty({ enum: ['pending', 'running', 'completed', 'failed', 'cancelled'] })
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

  @ApiProperty()
  progress: number;

  @ApiProperty({ required: false })
  startTime?: Date;

  @ApiProperty({ required: false })
  endTime?: Date;

  @ApiProperty({ required: false })
  errorMessage?: string;

  @ApiProperty()
  itemsTotal: number;

  @ApiProperty()
  itemsProcessed: number;

  @ApiProperty()
  itemsFailed: number;

  @ApiProperty({ required: false })
  metadata?: Record<string, unknown>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false, type: [OperationLogEntry] })
  operationLogs?: OperationLogEntry[];
}

export class OperationLogEntry {
  @ApiProperty()
  id: string;

  @ApiProperty({ required: false })
  itemId?: string;

  @ApiProperty({ required: false })
  itemName?: string;

  @ApiProperty()
  operation: string;

  @ApiProperty({ required: false })
  beforeJson?: Record<string, unknown>;

  @ApiProperty({ required: false })
  afterJson?: Record<string, unknown>;

  @ApiProperty()
  success: boolean;

  @ApiProperty({ required: false })
  errorMessage?: string;

  @ApiProperty()
  createdAt: Date;
}