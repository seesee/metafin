import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { DiffService, CurrentMetadata, ProposedMetadata } from '../../common/services/diff.service';
import {
  BulkOperationRequest,
  OperationPreviewResponse,
  ExecuteOperationRequest,
  ExecuteOperationResponse,
  JobStatusResponse,
  OperationType,
  ScopeType,
  ItemDiff,
  MetadataChange,
  DiffSummary,
  OperationLogEntry,
} from '../dto/bulk-operation.dto';
import { randomUUID } from 'crypto';

interface PreviewTokenData {
  request: BulkOperationRequest;
  itemIds: string[];
  createdAt: number;
}

@Injectable()
export class BulkOperationsService {
  private readonly previewTokens = new Map<string, PreviewTokenData>();
  private readonly TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

  constructor(
    private readonly database: DatabaseService,
    private readonly diffService: DiffService,
  ) {}

  async generatePreview(request: BulkOperationRequest): Promise<OperationPreviewResponse> {
    // Resolve scope to get list of item IDs
    const itemIds = await this.resolveScope(request.scope);

    if (itemIds.length === 0) {
      return {
        previewToken: '',
        totalItems: 0,
        estimatedApiCalls: 0,
        changes: [],
        summary: {
          totalItems: 0,
          itemsWithChanges: 0,
          itemsWithConflicts: 0,
          changesByField: {},
        },
      };
    }

    // Fetch current metadata for all items
    const items = await this.database.item.findMany({
      where: { id: { in: itemIds } },
      select: {
        id: true,
        name: true,
        overview: true,
        year: true,
        type: true,
        genres: true,
        tags: true,
        studios: true,
        providerIds: true,
        premiereDate: true,
        endDate: true,
      },
    });

    // Generate proposed changes for each item
    const diffItems = items.map((item: any) => {
      const current = this.mapItemToMetadata(item);
      const proposed = this.applyChangesToMetadata(current, request);
      return {
        itemId: item.id,
        current,
        proposed,
      };
    });

    // Compute diffs using the diff service
    const diffs = this.diffService.computeBulkDiff(diffItems);
    const summary = this.diffService.getDiffSummary(diffs);

    // Map to response format
    const changes: ItemDiff[] = diffs.map(diff => {
      const item = items.find((i: any) => i.id === diff.itemId)!;
      return {
        itemId: diff.itemId,
        itemName: item.name,
        hasChanges: diff.hasChanges,
        changes: diff.changes.map(this.mapMetadataChange),
        conflicts: diff.conflicts.map(this.mapMetadataChange),
      };
    });

    // Estimate API calls (assuming 1 call per item with changes)
    const estimatedApiCalls = changes.filter(c => c.hasChanges).length;

    // Generate and store preview token
    const previewToken = randomUUID();
    this.previewTokens.set(previewToken, {
      request,
      itemIds,
      createdAt: Date.now(),
    });

    // Clean up expired tokens
    this.cleanupExpiredTokens();

    return {
      previewToken,
      totalItems: items.length,
      estimatedApiCalls,
      changes,
      summary: {
        totalItems: summary.totalItems,
        itemsWithChanges: summary.itemsWithChanges,
        itemsWithConflicts: summary.itemsWithConflicts,
        changesByField: summary.changesByField,
      },
    };
  }

  async executeOperation(request: ExecuteOperationRequest): Promise<ExecuteOperationResponse> {
    const tokenData = this.previewTokens.get(request.previewToken);
    if (!tokenData) {
      throw new BadRequestException('Invalid or expired preview token');
    }

    // Check token expiry
    if (Date.now() - tokenData.createdAt > this.TOKEN_EXPIRY_MS) {
      this.previewTokens.delete(request.previewToken);
      throw new BadRequestException('Preview token has expired');
    }

    // Create job record
    const job = await this.database.job.create({
      data: {
        type: 'bulk-operation',
        status: 'pending',
        itemsTotal: tokenData.itemIds.length,
        metadata: JSON.stringify({
          operation: tokenData.request.operation,
          scope: tokenData.request.scope,
          changes: tokenData.request.changes,
          previewToken: request.previewToken,
        }),
      },
    });

    // Remove token (it's been consumed)
    this.previewTokens.delete(request.previewToken);

    // Execute the operation asynchronously
    this.executeJobAsync(job.id, tokenData.request, tokenData.itemIds);

    return {
      jobId: job.id,
      status: 'pending',
      estimatedDuration: this.estimateDuration(tokenData.itemIds.length),
    };
  }

  async getJobStatus(jobId: string, includeDetails = false): Promise<JobStatusResponse> {
    const job = await this.database.job.findUnique({
      where: { id: jobId },
      include: {
        operationLogs: includeDetails
          ? {
              include: {
                item: { select: { name: true } },
              },
              orderBy: { createdAt: 'desc' },
              take: 100, // Limit to recent entries
            }
          : false,
      },
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const response: JobStatusResponse = {
      id: job.id,
      type: job.type,
      status: job.status as any,
      progress: job.progress,
      startTime: job.startTime || undefined,
      endTime: job.endTime || undefined,
      errorMessage: job.errorMessage || undefined,
      itemsTotal: job.itemsTotal,
      itemsProcessed: job.itemsProcessed,
      itemsFailed: job.itemsFailed,
      metadata: job.metadata ? JSON.parse(job.metadata) : undefined,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };

    if (includeDetails && job.operationLogs) {
      response.operationLogs = job.operationLogs.map((log: any) => ({
        id: log.id,
        itemId: log.itemId,
        itemName: log.item?.name,
        operation: log.operation,
        beforeJson: log.beforeJson ? JSON.parse(log.beforeJson) : undefined,
        afterJson: log.afterJson ? JSON.parse(log.afterJson) : undefined,
        success: log.success,
        errorMessage: log.errorMessage,
        createdAt: log.createdAt,
      }));
    }

    return response;
  }

  private async resolveScope(scope: any): Promise<string[]> {
    switch (scope.type) {
      case ScopeType.SPECIFIC_ITEMS:
        return scope.itemIds || [];

      case ScopeType.LIBRARY_FILTER:
        const libraryItems = await this.database.item.findMany({
          where: {
            libraryId: scope.libraryId,
            ...(scope.itemType && { type: scope.itemType }),
          },
          select: { id: true },
        });
        return libraryItems.map((item: any) => item.id);

      case ScopeType.SEARCH_QUERY:
        const searchItems = await this.database.item.findMany({
          where: {
            OR: [
              { name: { contains: scope.searchQuery } },
              { overview: { contains: scope.searchQuery } },
              { path: { contains: scope.searchQuery } },
            ],
            ...(scope.libraryId && { libraryId: scope.libraryId }),
            ...(scope.itemType && { type: scope.itemType }),
          },
          select: { id: true },
        });
        return searchItems.map((item: any) => item.id);

      default:
        throw new BadRequestException(`Invalid scope type: ${scope.type}`);
    }
  }

  private mapItemToMetadata(item: any): CurrentMetadata {
    return {
      name: item.name,
      overview: item.overview,
      year: item.year,
      type: item.type,
      genres: item.genres ? JSON.parse(item.genres) : [],
      tags: item.tags ? JSON.parse(item.tags) : [],
      studios: item.studios ? JSON.parse(item.studios) : [],
      providerIds: item.providerIds ? JSON.parse(item.providerIds) : {},
      premiereDate: item.premiereDate,
      endDate: item.endDate,
    };
  }

  private applyChangesToMetadata(
    current: CurrentMetadata,
    request: BulkOperationRequest,
  ): ProposedMetadata {
    if (request.operation !== OperationType.UPDATE_METADATA || !request.changes) {
      return current;
    }

    return {
      ...current,
      ...request.changes,
    };
  }

  private mapMetadataChange(change: any): MetadataChange {
    return {
      field: change.field,
      type: change.type,
      before: change.before,
      after: change.after,
      hasConflict: change.hasConflict,
      conflictReason: change.conflictReason,
    };
  }

  private async executeJobAsync(
    jobId: string,
    request: BulkOperationRequest,
    itemIds: string[],
  ): Promise<void> {
    try {
      // Update job status to running
      await this.database.job.update({
        where: { id: jobId },
        data: {
          status: 'running',
          startTime: new Date(),
        },
      });

      // Process items in batches
      const BATCH_SIZE = 10;
      let processed = 0;
      let failed = 0;

      for (let i = 0; i < itemIds.length; i += BATCH_SIZE) {
        const batch = itemIds.slice(i, i + BATCH_SIZE);

        for (const itemId of batch) {
          try {
            await this.processItem(jobId, itemId, request);
            processed++;
          } catch (error) {
            failed++;
            await this.logOperation(jobId, itemId, request.operation, false, (error as Error).message);
          }

          // Update progress
          const progress = (processed + failed) / itemIds.length;
          await this.database.job.update({
            where: { id: jobId },
            data: {
              progress,
              itemsProcessed: processed,
              itemsFailed: failed,
            },
          });
        }

        // Small delay between batches to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Mark job as completed
      await this.database.job.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          endTime: new Date(),
          progress: 1.0,
        },
      });
    } catch (error) {
      // Mark job as failed
      await this.database.job.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          endTime: new Date(),
          errorMessage: (error as Error).message,
        },
      });
    }
  }

  private async processItem(
    jobId: string,
    itemId: string,
    request: BulkOperationRequest,
  ): Promise<void> {
    const item = await this.database.item.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }

    const beforeJson = JSON.stringify(this.mapItemToMetadata(item));

    switch (request.operation) {
      case OperationType.UPDATE_METADATA:
        if (request.changes) {
          const updateData: any = {};

          if (request.changes.name !== undefined) updateData.name = request.changes.name;
          if (request.changes.overview !== undefined) updateData.overview = request.changes.overview;
          if (request.changes.year !== undefined) updateData.year = request.changes.year;
          if (request.changes.type !== undefined) updateData.type = request.changes.type;
          if (request.changes.genres !== undefined) updateData.genres = JSON.stringify(request.changes.genres);
          if (request.changes.tags !== undefined) updateData.tags = JSON.stringify(request.changes.tags);
          if (request.changes.studios !== undefined) updateData.studios = JSON.stringify(request.changes.studios);
          if (request.changes.providerIds !== undefined) updateData.providerIds = JSON.stringify(request.changes.providerIds);
          if (request.changes.premiereDate !== undefined) updateData.premiereDate = request.changes.premiereDate;
          if (request.changes.endDate !== undefined) updateData.endDate = request.changes.endDate;
          if (request.changes.officialRating !== undefined) updateData.officialRating = request.changes.officialRating;

          const updatedItem = await this.database.item.update({
            where: { id: itemId },
            data: updateData,
          });

          const afterJson = JSON.stringify(this.mapItemToMetadata(updatedItem));
          await this.logOperation(jobId, itemId, request.operation, true, undefined, beforeJson, afterJson);
        }
        break;

      default:
        throw new Error(`Operation ${request.operation} not yet implemented`);
    }
  }

  private async logOperation(
    jobId: string,
    itemId: string,
    operation: string,
    success: boolean,
    errorMessage?: string | undefined,
    beforeJson?: string,
    afterJson?: string,
  ): Promise<void> {
    await this.database.operationLog.create({
      data: {
        jobId,
        itemId,
        operation,
        success,
        errorMessage,
        beforeJson,
        afterJson,
        requestId: randomUUID(), // You might want to get this from request context
      },
    });
  }

  private estimateDuration(itemCount: number): string {
    // Rough estimation: 1 second per item
    const seconds = itemCount;
    if (seconds < 60) {
      return `${seconds} seconds`;
    } else if (seconds < 3600) {
      return `${Math.round(seconds / 60)} minutes`;
    } else {
      return `${Math.round(seconds / 3600)} hours`;
    }
  }

  async listJobs(options: {
    limit?: number;
    type?: string;
    status?: string;
  }): Promise<JobStatusResponse[]> {
    const jobs = await this.database.job.findMany({
      where: {
        ...(options.type && { type: options.type }),
        ...(options.status && { status: options.status }),
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit || 20,
    });

    return jobs.map((job: any) => ({
      id: job.id,
      type: job.type,
      status: job.status as any,
      progress: job.progress,
      startTime: job.startTime || undefined,
      endTime: job.endTime || undefined,
      errorMessage: job.errorMessage || undefined,
      itemsTotal: job.itemsTotal,
      itemsProcessed: job.itemsProcessed,
      itemsFailed: job.itemsFailed,
      metadata: job.metadata ? JSON.parse(job.metadata) : undefined,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    }));
  }

  private cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [token, data] of this.previewTokens.entries()) {
      if (now - data.createdAt > this.TOKEN_EXPIRY_MS) {
        this.previewTokens.delete(token);
      }
    }
  }
}