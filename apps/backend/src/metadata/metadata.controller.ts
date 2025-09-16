import { Controller, Post, Put, Delete, Body, Param } from '@nestjs/common';
import {
  MetadataService,
  MetadataUpdate,
  ArtworkUpdate,
} from './metadata.service.js';
import type { BulkOperationPreview, ArtworkCandidate } from '@metafin/shared';

@Controller('api/metadata')
export class MetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  @Post('preview')
  async previewBulkUpdate(
    @Body() body: { updates: MetadataUpdate[] }
  ): Promise<BulkOperationPreview> {
    return this.metadataService.previewBulkMetadataUpdate(body.updates);
  }

  @Post('bulk-update')
  async applyBulkUpdate(@Body() body: { updates: MetadataUpdate[] }): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ itemId: string; error: string }>;
  }> {
    return this.metadataService.applyBulkMetadataUpdates(body.updates);
  }

  @Put('item/:itemId/artwork')
  async updateArtwork(
    @Param('itemId') itemId: string,
    @Body() body: Omit<ArtworkUpdate, 'itemId'>
  ): Promise<{ message: string }> {
    await this.metadataService.applyArtworkUpdate({
      itemId,
      ...body,
    });

    return { message: 'Artwork updated successfully' };
  }

  @Post('artwork/bulk-apply')
  async bulkApplyArtwork(
    @Body() body: { candidates: ArtworkCandidate[] }
  ): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ itemId: string; error: string }>;
  }> {
    return this.metadataService.bulkApplyArtwork(body.candidates);
  }

  @Post('collections')
  async createCollection(
    @Body() body: { name: string; itemIds: string[] }
  ): Promise<{ collectionId: string; message: string }> {
    const collectionId = await this.metadataService.applyCollectionUpdate({
      operation: 'create',
      name: body.name,
      itemIds: body.itemIds,
    });

    return {
      collectionId: collectionId!,
      message: 'Collection created successfully',
    };
  }

  @Put('collections/:collectionId')
  async updateCollection(
    @Param('collectionId') collectionId: string,
    @Body()
    body: {
      name?: string;
      itemIds?: string[];
      operation: 'update' | 'add_items' | 'remove_items';
    }
  ): Promise<{ message: string }> {
    await this.metadataService.applyCollectionUpdate({
      operation: body.operation,
      collectionId,
      name: body.name || '',
      itemIds: body.itemIds || [],
    });

    return { message: 'Collection updated successfully' };
  }

  @Delete('collections/:collectionId')
  async deleteCollection(
    @Param('collectionId') collectionId: string
  ): Promise<{ message: string }> {
    await this.metadataService.applyCollectionUpdate({
      operation: 'delete',
      collectionId,
      name: '',
      itemIds: [],
    });

    return { message: 'Collection deleted successfully' };
  }
}
