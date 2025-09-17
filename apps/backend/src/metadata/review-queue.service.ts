import { Injectable } from '@nestjs/common';
import { LoggerService } from '../modules/logger/logger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { AppError } from '@metafin/shared';

export interface ReviewQueueItem {
  id: string;
  jellyfinId: string;
  name: string;
  type: string;
  library: {
    name: string;
  };
  path?: string;
  misclassificationScore?: number;
  misclassificationReasons?: string;
  priority: 'low' | 'medium' | 'high';
  addedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  status: 'pending' | 'reviewed' | 'dismissed';
}

export interface ReviewQueueStats {
  totalItems: number;
  pendingItems: number;
  highPriorityItems: number;
  mediumPriorityItems: number;
  lowPriorityItems: number;
  averageScore: number;
  oldestItemAge: number; // days
}

export interface ReviewAction {
  action: 'dismiss' | 'correct_type' | 'update_metadata' | 'flag_for_manual';
  newType?: string;
  metadata?: Record<string, unknown>;
  notes?: string;
}

@Injectable()
export class ReviewQueueService {
  constructor(
    private readonly logger: LoggerService,
    private readonly database: DatabaseService
  ) {}

  async getReviewQueue(
    options: {
      status?: 'pending' | 'reviewed' | 'dismissed';
      priority?: 'low' | 'medium' | 'high';
      libraryId?: string;
      limit?: number;
      offset?: number;
      sortBy?: 'score' | 'addedAt' | 'priority';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{
    items: ReviewQueueItem[];
    pagination: {
      limit: number;
      offset: number;
      total: number;
      hasMore: boolean;
    };
  }> {
    const {
      _status = 'pending',
      priority,
      libraryId,
      limit = 50,
      offset = 0,
      sortBy = 'score',
      sortOrder = 'desc',
    } = options;

    const whereClause: Record<string, unknown> = {
      suspectedMisclassification: true,
    };

    if (libraryId) {
      whereClause.libraryId = libraryId;
    }

    // Filter by priority based on misclassification score
    if (priority) {
      switch (priority) {
        case 'high':
          whereClause.misclassificationScore = { gte: 0.8 };
          break;
        case 'medium':
          whereClause.misclassificationScore = { gte: 0.5, lt: 0.8 };
          break;
        case 'low':
          whereClause.misclassificationScore = { lt: 0.5 };
          break;
      }
    }

    // Build order by clause
    let orderBy: Record<string, unknown> = {};
    switch (sortBy) {
      case 'score':
        orderBy = { misclassificationScore: sortOrder };
        break;
      case 'addedAt':
        orderBy = { createdAt: sortOrder };
        break;
      case 'priority':
        orderBy = { misclassificationScore: 'desc' }; // Higher score = higher priority
        break;
      default:
        orderBy = { misclassificationScore: 'desc' };
    }

    const [items, total] = await Promise.all([
      this.database.item.findMany({
        where: whereClause,
        include: {
          library: {
            select: { name: true },
          },
        },
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.database.item.count({ where: whereClause }),
    ]);

    const reviewQueueItems = items.map((item) => ({
      id: item.id,
      jellyfinId: item.jellyfinId,
      name: item.name,
      type: item.type,
      library: item.library,
      path: item.path || undefined,
      misclassificationScore: item.misclassificationScore ?? undefined,
      misclassificationReasons: item.misclassificationReasons,
      priority: this.calculatePriority(item.misclassificationScore || 0),
      addedAt: item.createdAt.toISOString(),
      status: 'pending', // For now, all items are pending
    }));

    return {
      items: reviewQueueItems,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    };
  }

  async getReviewQueueStats(libraryId?: string): Promise<ReviewQueueStats> {
    const whereClause: Record<string, unknown> = {
      suspectedMisclassification: true,
    };

    if (libraryId) {
      whereClause.libraryId = libraryId;
    }

    const items = await this.database.item.findMany({
      where: whereClause,
      select: {
        misclassificationScore: true,
        createdAt: true,
      },
    });

    const totalItems = items.length;
    const pendingItems = totalItems; // For now, all items are pending

    let highPriorityItems = 0;
    let mediumPriorityItems = 0;
    let lowPriorityItems = 0;
    let totalScore = 0;
    let oldestDate = new Date();

    for (const item of items) {
      const score = item.misclassificationScore || 0;
      totalScore += score;

      if (score >= 0.8) {
        highPriorityItems++;
      } else if (score >= 0.5) {
        mediumPriorityItems++;
      } else {
        lowPriorityItems++;
      }

      if (item.createdAt < oldestDate) {
        oldestDate = item.createdAt;
      }
    }

    const averageScore = totalItems > 0 ? totalScore / totalItems : 0;
    const oldestItemAge = Math.floor(
      (Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      totalItems,
      pendingItems,
      highPriorityItems,
      mediumPriorityItems,
      lowPriorityItems,
      averageScore,
      oldestItemAge,
    };
  }

  async reviewItem(
    itemId: string,
    action: ReviewAction,
    reviewedBy?: string
  ): Promise<void> {
    const item = await this.database.item.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw AppError.notFound(`Item not found: ${itemId}`);
    }

    switch (action.action) {
      case 'dismiss':
        await this.database.item.update({
          where: { id: itemId },
          data: {
            suspectedMisclassification: false,
            misclassificationScore: null,
            misclassificationReasons: null,
          },
        });
        break;

      case 'correct_type':
        if (!action.newType) {
          throw new Error('New type required for correct_type action');
        }
        // In a real implementation, this would update Jellyfin as well
        await this.database.item.update({
          where: { id: itemId },
          data: {
            type: action.newType,
            suspectedMisclassification: false,
            misclassificationScore: null,
            misclassificationReasons: null,
          },
        });
        break;

      case 'update_metadata': {
        if (!action.metadata) {
          throw new Error('Metadata required for update_metadata action');
        }
        // Apply metadata updates
        const updateData: Record<string, unknown> = {
          suspectedMisclassification: false,
          misclassificationScore: null,
          misclassificationReasons: null,
        };

        if (action.metadata.name) updateData.name = action.metadata.name;
        if (action.metadata.overview)
          updateData.overview = action.metadata.overview;
        if (action.metadata.year) updateData.year = action.metadata.year;
        if (action.metadata.genres)
          updateData.genres = JSON.stringify(action.metadata.genres);
        if (action.metadata.tags)
          updateData.tags = JSON.stringify(action.metadata.tags);

        await this.database.item.update({
          where: { id: itemId },
          data: updateData,
        });
        break;
      }

      case 'flag_for_manual':
        // Keep the misclassification flag but log that it needs manual attention
        await this.database.operationLog.create({
          data: {
            itemId,
            operation: 'flag-manual-review',
            beforeJson: JSON.stringify(item),
            afterJson: JSON.stringify({
              flaggedForManualReview: true,
              notes: action.notes,
            }),
            success: true,
            requestId: `review-${Date.now()}`,
          },
        });
        break;

      default:
        throw new Error(`Unknown review action: ${action.action}`);
    }

    this.logger.log(
      `Reviewed item ${itemId} with action ${action.action} by ${reviewedBy || 'system'}`,
      'ReviewQueueService'
    );
  }

  async bulkReviewItems(
    itemIds: string[],
    action: ReviewAction,
    reviewedBy?: string
  ): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ itemId: string; error: string }>;
  }> {
    let successful = 0;
    let failed = 0;
    const errors: Array<{ itemId: string; error: string }> = [];

    for (const itemId of itemIds) {
      try {
        await this.reviewItem(itemId, action, reviewedBy);
        successful++;
      } catch (error) {
        failed++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push({ itemId, error: errorMessage });
        this.logger.error(
          `Failed to review item ${itemId}: ${errorMessage}`,
          'ReviewQueueService'
        );
      }
    }

    this.logger.log(
      `Bulk review completed: ${successful} successful, ${failed} failed`,
      'ReviewQueueService'
    );

    return { successful, failed, errors };
  }

  async getItemHistory(itemId: string): Promise<
    Array<{
      timestamp: string;
      operation: string;
      details: unknown;
      success: boolean;
    }>
  > {
    const logs = await this.database.operationLog.findMany({
      where: { itemId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return logs.map((log) => ({
      timestamp: log.createdAt.toISOString(),
      operation: log.operation,
      details: {
        before: log.beforeJson ? JSON.parse(log.beforeJson) : null,
        after: log.afterJson ? JSON.parse(log.afterJson) : null,
        error: log.errorMessage,
      },
      success: log.success,
    }));
  }

  private calculatePriority(score: number): 'low' | 'medium' | 'high' {
    if (score >= 0.8) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  }

  async markAllAsReviewed(libraryId?: string): Promise<number> {
    const whereClause: Record<string, unknown> = {
      suspectedMisclassification: true,
    };

    if (libraryId) {
      whereClause.libraryId = libraryId;
    }

    const result = await this.database.item.updateMany({
      where: whereClause,
      data: {
        suspectedMisclassification: false,
        misclassificationScore: null,
        misclassificationReasons: null,
      },
    });

    this.logger.log(
      `Marked ${result.count} items as reviewed${libraryId ? ` in library ${libraryId}` : ''}`,
      'ReviewQueueService'
    );

    return result.count;
  }
}
