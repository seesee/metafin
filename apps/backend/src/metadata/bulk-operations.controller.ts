import { Controller, Post, Body } from '@nestjs/common';
import {
  BulkOperationsService,
  BulkMetadataUpdate,
  BulkSearchAndMatch,
} from './bulk-operations.service.js';

@Controller('api/bulk')
export class BulkOperationsController {
  constructor(private readonly bulkOperationsService: BulkOperationsService) {}

  @Post('metadata/update')
  async bulkUpdateMetadata(@Body() body: { updates: BulkMetadataUpdate[] }) {
    const results = await this.bulkOperationsService.bulkUpdateMetadata(
      body.updates
    );

    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.length - successCount;

    return {
      message: `Bulk update completed: ${successCount} successful, ${errorCount} failed`,
      summary: {
        total: results.length,
        successful: successCount,
        failed: errorCount,
      },
      results,
    };
  }

  @Post('metadata/search-and-match')
  async bulkSearchAndMatch(@Body() body: BulkSearchAndMatch) {
    const results = await this.bulkOperationsService.bulkSearchAndMatch(body);

    const withMatches = results.filter((r) => r.matches.length > 0).length;
    const withBestMatch = results.filter((r) => r.bestMatch).length;

    return {
      message: `Search completed: ${withMatches} items with matches, ${withBestMatch} with best match`,
      summary: {
        total: results.length,
        withMatches,
        withBestMatch,
        autoApplied: body.autoApply ? withBestMatch : 0,
      },
      results,
    };
  }

  @Post('collections/add')
  async bulkAddToCollection(
    @Body() body: { collectionId: string; itemIds: string[] }
  ) {
    const results = await this.bulkOperationsService.bulkAddToCollection(
      body.collectionId,
      body.itemIds
    );

    const successCount = results.filter((r) => r.success).length;

    return {
      message: `Added ${successCount} items to collection`,
      summary: {
        total: results.length,
        successful: successCount,
        failed: results.length - successCount,
      },
      results,
    };
  }

  @Post('collections/remove')
  async bulkRemoveFromCollection(
    @Body() body: { collectionId: string; itemIds: string[] }
  ) {
    const results = await this.bulkOperationsService.bulkRemoveFromCollection(
      body.collectionId,
      body.itemIds
    );

    const successCount = results.filter((r) => r.success).length;

    return {
      message: `Removed ${successCount} items from collection`,
      summary: {
        total: results.length,
        successful: successCount,
        failed: results.length - successCount,
      },
      results,
    };
  }

  @Post('metadata/apply-provider-match')
  async applyProviderMatch(
    @Body()
    body: {
      itemId: string;
      provider: string;
      providerId: string;
      metadata: Record<string, unknown>;
    }
  ) {
    const update: BulkMetadataUpdate = {
      itemId: body.itemId,
      updates: {
        name: body.metadata.name as string,
        overview: body.metadata.overview as string,
        year: body.metadata.year as number,
        genres: body.metadata.genres as string[],
        tags: body.metadata.tags as string[],
        studios: body.metadata.studios as string[],
        people: body.metadata.people as Array<{
          name: string;
          role?: string;
          type: string;
        }>,
      },
    };

    const results = await this.bulkOperationsService.bulkUpdateMetadata([
      update,
    ]);

    return {
      message: results[0].success
        ? 'Provider metadata applied successfully'
        : 'Failed to apply provider metadata',
      result: results[0],
    };
  }
}
