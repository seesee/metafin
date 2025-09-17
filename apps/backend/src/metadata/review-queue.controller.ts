import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ReviewQueueService, ReviewAction } from './review-queue.service.js';

@Controller('api/review-queue')
export class ReviewQueueController {
  constructor(private readonly reviewQueueService: ReviewQueueService) {}

  @Get()
  async getReviewQueue(
    @Query('status') status?: 'pending' | 'reviewed' | 'dismissed',
    @Query('priority') priority?: 'low' | 'medium' | 'high',
    @Query('library') libraryId?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
    @Query('offset', new ParseIntPipe({ optional: true })) offset = 0,
    @Query('sortBy') sortBy?: 'score' | 'addedAt' | 'priority',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc'
  ) {
    return this.reviewQueueService.getReviewQueue({
      status,
      priority,
      libraryId,
      limit,
      offset,
      sortBy,
      sortOrder,
    });
  }

  @Get('stats')
  async getReviewQueueStats(@Query('library') libraryId?: string) {
    return this.reviewQueueService.getReviewQueueStats(libraryId);
  }

  @Get(':itemId/history')
  async getItemHistory(@Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.reviewQueueService.getItemHistory(itemId);
  }

  @Post(':itemId/review')
  async reviewItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() body: ReviewAction & { reviewedBy?: string }
  ) {
    const { reviewedBy, ...action } = body;
    await this.reviewQueueService.reviewItem(itemId, action, reviewedBy);
    return { success: true, message: 'Item reviewed successfully' };
  }

  @Post('bulk-review')
  async bulkReviewItems(
    @Body()
    body: {
      itemIds: string[];
      action: ReviewAction;
      reviewedBy?: string;
    }
  ) {
    const { itemIds, action, reviewedBy } = body;
    return this.reviewQueueService.bulkReviewItems(itemIds, action, reviewedBy);
  }

  @Delete('clear')
  async clearReviewQueue(@Query('library') libraryId?: string) {
    const count = await this.reviewQueueService.markAllAsReviewed(libraryId);
    return {
      success: true,
      message: `Marked ${count} items as reviewed`,
      itemsCleared: count,
    };
  }
}
