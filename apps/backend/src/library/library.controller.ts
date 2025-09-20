import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Query,
  Param,
  Res,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { LibrarySyncService, SyncProgress } from './library-sync.service.js';
import { DatabaseService } from '../database/database.service.js';
import { JellyfinService } from '../jellyfin/jellyfin.service.js';
import { ArtworkService } from '../metadata/artwork.service.js';
import { Response } from 'express';
import {
  transformItemsForSerialization,
  transformItemForSerialization
} from '../common/utils/serialization.util.js';

export interface StartSyncRequest {
  fullSync?: boolean;
  libraryIds?: string[];
}

export interface LibraryItemsQuery {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  library?: string;
  hasArtwork?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UpdateLibraryItemRequest {
  name?: string;
  overview?: string;
  year?: number;
  genres?: string[];
  tags?: string[];
  studios?: string[];
  premiereDate?: string;
  endDate?: string;
  type?: 'Series' | 'Season' | 'Episode' | 'Movie';
}

export interface ArtworkCandidatesQuery {
  type?: string; // Primary, Backdrop, Thumb, Logo, Banner
  source?: string;
  includeApplied?: boolean;
}

export interface ApplyArtworkRequest {
  candidateId?: string;
  artworkUrl?: string;
  artworkType: string;
}

export interface SearchArtworkRequest {
  query?: string;
  type?: string;
  language?: string;
}


@ApiTags('library')
@Controller('api/library')
export class LibraryController {
  constructor(
    private readonly librarySyncService: LibrarySyncService,
    private readonly databaseService: DatabaseService,
    private readonly jellyfinService: JellyfinService,
    private readonly artworkService: ArtworkService
  ) {}

  @Post('sync')
  @ApiOperation({
    summary: 'Start library synchronisation',
    description: 'Initiates synchronisation between Jellyfin libraries and the local database'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fullSync: { type: 'boolean', description: 'Whether to perform a full sync' },
        libraryIds: { type: 'array', items: { type: 'string' }, description: 'Specific library IDs to sync' }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Synchronisation started successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        progress: { type: 'object' }
      }
    }
  })
  async startSync(
    @Body() body: StartSyncRequest
  ): Promise<{ message: string; progress?: SyncProgress }> {
    await this.librarySyncService.startSync(body);
    const progress = this.librarySyncService.getSyncProgress();

    return {
      message: 'Library sync started',
      progress: progress || undefined,
    };
  }

  @Get('sync/status')
  getSyncStatus(): { progress: SyncProgress | null } {
    return {
      progress: this.librarySyncService.getSyncProgress(),
    };
  }

  @Post('sync/cancel')
  async cancelSync(): Promise<{ message: string }> {
    await this.librarySyncService.cancelSync();
    return {
      message: 'Library sync cancelled',
    };
  }

  @Get('items')
  @ApiOperation({
    summary: 'Get library items',
    description: 'Retrieve a paginated list of library items with optional filtering and sorting'
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 24, max: 100)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term for item names, descriptions, and file paths' })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Filter by item type (Series, Season, Episode)' })
  @ApiQuery({ name: 'library', required: false, type: String, description: 'Filter by library name' })
  @ApiQuery({ name: 'hasArtwork', required: false, type: Boolean, description: 'Filter by artwork availability' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Field to sort by' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Sort order' })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved library items',
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array' },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' }
          }
        }
      }
    }
  })
  async getLibraryItems(@Query() query: LibraryItemsQuery) {
    const page = parseInt(String(query.page || '1'));
    const limit = Math.min(parseInt(String(query.limit || '24')), 100);
    const offset = (page - 1) * limit;

    // Build where clause based on filters
    const where: Record<string, unknown> = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { overview: { contains: query.search } },
        { path: { contains: query.search } },
      ];
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.library) {
      where.library = {
        name: query.library,
      };
    }

    if (query.hasArtwork !== undefined) {
      where.hasArtwork = query.hasArtwork;
    }

    // Build order by clause
    const orderBy: Record<string, string> = {};
    if (query.sortBy) {
      orderBy[query.sortBy] = query.sortOrder || 'asc';
    } else {
      orderBy.name = 'asc';
    }

    const [items, total] = await Promise.all([
      this.databaseService.item.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          library: {
            select: {
              name: true,
            },
          },
        },
      }),
      this.databaseService.item.count({ where }),
    ]);

    return {
      items: transformItemsForSerialization(items),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Get('items/:id')
  async getLibraryItem(@Param('id') id: string) {
    const item = await this.databaseService.item.findUnique({
      where: { id },
      include: {
        library: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!item) {
      throw new Error('Item not found');
    }

    return transformItemForSerialization(item);
  }

  @Get('libraries')
  async getLibraries() {
    const libraries = await this.databaseService.library.findMany({
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    return libraries.map((lib) => ({
      id: lib.id,
      name: lib.name,
      type: lib.type,
      itemCount: lib._count.items,
      lastSyncAt: lib.lastSyncAt,
    }));
  }

  @Put('items/:id')
  async updateLibraryItem(
    @Param('id') id: string,
    @Body() updateData: UpdateLibraryItemRequest
  ) {
    // First get the current item to check if it exists and get jellyfinId
    const currentItem = await this.databaseService.item.findUnique({
      where: { id },
      select: {
        id: true,
        jellyfinId: true,
      },
    });

    if (!currentItem) {
      throw new Error('Item not found');
    }

    // Update the item in the database
    const updatedItem = await this.databaseService.item.update({
      where: { id },
      data: {
        name: updateData.name,
        overview: updateData.overview,
        year: updateData.year,
        type: updateData.type,
        genres: updateData.genres
          ? JSON.stringify(updateData.genres)
          : undefined,
        tags: updateData.tags ? JSON.stringify(updateData.tags) : undefined,
        studios: updateData.studios
          ? JSON.stringify(updateData.studios)
          : undefined,
        premiereDate: updateData.premiereDate
          ? new Date(updateData.premiereDate)
          : undefined,
        endDate: updateData.endDate ? new Date(updateData.endDate) : undefined,
        lastSyncAt: new Date(),
      },
      include: {
        library: {
          select: {
            name: true,
          },
        },
      },
    });

    // Try to sync metadata back to Jellyfin using the hybrid approach
    try {
      await this.jellyfinService.writeMetadataViaFile(
        currentItem.jellyfinId,
        updateData
      );
      console.log(
        `Successfully synced metadata to Jellyfin for item ${currentItem.jellyfinId}`
      );
    } catch (error) {
      console.warn(
        `Failed to sync metadata to Jellyfin for item ${currentItem.jellyfinId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // Continue without failing the request - metadata is still saved locally
    }

    return transformItemForSerialization(updatedItem);
  }

  @Get('items/:id/artwork/candidates')
  async getArtworkCandidates(
    @Param('id') id: string,
    @Query() query: ArtworkCandidatesQuery
  ) {
    const candidates = await this.artworkService.getCandidatesForItem(
      id,
      query.type,
      query.source,
      query.includeApplied
    );

    return { candidates };
  }

  @Post('items/:id/artwork/aggregate')
  async aggregateArtwork(
    @Param('id') id: string,
    @Body() options: {
      types?: string[];
      language?: string;
      autoStore?: boolean;
      forceRefresh?: boolean;
    } = {}
  ) {
    const result = await this.artworkService.aggregateArtworkForItem({
      itemId: id,
      types: options.types,
      language: options.language,
      autoStore: options.autoStore !== false, // Default to true
      forceRefresh: options.forceRefresh || false,
    });

    return result;
  }

  @Post('artwork/bulk-aggregate')
  async bulkAggregateArtwork(
    @Body() request: {
      itemIds: string[];
      types?: string[];
      language?: string;
      autoStore?: boolean;
      forceRefresh?: boolean;
    }
  ) {
    if (!request.itemIds || request.itemIds.length === 0) {
      throw new Error('itemIds array is required and cannot be empty');
    }

    const results = await this.artworkService.bulkAggregateArtwork(
      request.itemIds,
      {
        types: request.types,
        language: request.language,
        autoStore: request.autoStore !== false, // Default to true
        forceRefresh: request.forceRefresh || false,
      }
    );

    const successful = results.filter((r) => r.errors.length === 0).length;

    return {
      results,
      summary: {
        total: request.itemIds.length,
        successful,
        failed: request.itemIds.length - successful,
        totalCandidatesFound: results.reduce(
          (sum, r) => sum + r.candidatesFound,
          0
        ),
        totalCandidatesStored: results.reduce(
          (sum, r) => sum + r.candidatesStored,
          0
        ),
      },
    };
  }

  @Post('items/:id/artwork/apply')
  async applyArtwork(
    @Param('id') id: string,
    @Body() body: ApplyArtworkRequest
  ) {
    // Get the current item to check if it exists and get jellyfinId
    const item = await this.databaseService.item.findUnique({
      where: { id },
      select: {
        id: true,
        jellyfinId: true,
      },
    });

    if (!item) {
      throw new Error('Item not found');
    }

    let artworkUrl: string;
    let candidateToUpdate: string | undefined;

    if (body.candidateId) {
      // Apply existing candidate
      const candidate = await this.databaseService.artworkCandidate.findUnique({
        where: { id: body.candidateId },
      });

      if (!candidate || candidate.itemId !== id) {
        throw new Error('Artwork candidate not found');
      }

      artworkUrl = candidate.url;
      candidateToUpdate = candidate.id;
    } else if (body.artworkUrl) {
      // Apply custom artwork URL
      artworkUrl = body.artworkUrl;
    } else {
      throw new Error('Either candidateId or artworkUrl must be provided');
    }

    // Apply artwork to Jellyfin
    try {
      await this.jellyfinService.applyItemArtwork(
        item.jellyfinId,
        body.artworkType,
        artworkUrl
      );
    } catch (error) {
      throw new Error(
        `Failed to apply artwork to Jellyfin: ${(error as Error).message}`
      );
    }

    // Update candidate as applied if it was from a candidate
    if (candidateToUpdate) {
      await this.databaseService.artworkCandidate.update({
        where: { id: candidateToUpdate },
        data: { isApplied: true },
      });
    }

    // Update item artwork flag
    await this.databaseService.item.update({
      where: { id },
      data: {
        hasArtwork: true,
        lastSyncAt: new Date(),
      },
    });

    return { success: true, message: 'Artwork applied successfully' };
  }

  @Post('items/:id/artwork/upload')
  async uploadCustomArtwork(
    @Param('id') id: string,
    @Body() body: { artworkType: string; imageData: string; contentType: string }
  ) {
    // Get the current item to check if it exists and get jellyfinId
    const item = await this.databaseService.item.findUnique({
      where: { id },
      select: {
        id: true,
        jellyfinId: true,
      },
    });

    if (!item) {
      throw new Error('Item not found');
    }

    // Convert base64 image data to buffer
    const imageBuffer = Buffer.from(body.imageData, 'base64');

    // Upload to Jellyfin
    try {
      await this.jellyfinService.uploadItemArtwork(
        item.jellyfinId,
        body.artworkType,
        imageBuffer,
        body.contentType
      );
    } catch (error) {
      throw new Error(
        `Failed to upload artwork to Jellyfin: ${(error as Error).message}`
      );
    }

    // Update item artwork flag
    await this.databaseService.item.update({
      where: { id },
      data: {
        hasArtwork: true,
        lastSyncAt: new Date(),
      },
    });

    return { success: true, message: 'Artwork uploaded successfully' };
  }

  @Post('items/:id/artwork/search')
  async searchArtwork(
    @Param('id') id: string,
    @Body() body: SearchArtworkRequest
  ) {
    // Get the item to search artwork for
    const item = await this.databaseService.item.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        year: true,
      },
    });

    if (!item) {
      throw new Error('Item not found');
    }

    // Search query defaults to item name if not provided
    const searchQuery = body.query || item.name;

    // This would integrate with artwork providers in the future
    // For now, return a placeholder response
    const candidates = [
      {
        id: 'search-result-1',
        type: body.type || 'Primary',
        url: `https://example.com/artwork/${item.type}/${encodeURIComponent(searchQuery)}/1.jpg`,
        width: 500,
        height: 750,
        language: body.language || 'en',
        source: 'search',
        confidence: 0.8,
      },
      {
        id: 'search-result-2',
        type: body.type || 'Primary',
        url: `https://example.com/artwork/${item.type}/${encodeURIComponent(searchQuery)}/2.jpg`,
        width: 500,
        height: 750,
        language: body.language || 'en',
        source: 'search',
        confidence: 0.6,
      },
    ];

    return {
      query: searchQuery,
      type: body.type,
      candidates,
    };
  }

  @Get('items/:id/image/:type')
  @ApiOperation({
    summary: 'Get item artwork image',
    description: 'Proxy Jellyfin artwork images through the backend'
  })
  @ApiParam({ name: 'id', description: 'Library item ID' })
  @ApiParam({ name: 'type', description: 'Image type (Primary, Backdrop, etc.)' })
  @ApiResponse({
    status: 200,
    description: 'Image data',
    schema: { type: 'string', format: 'binary' }
  })
  @ApiResponse({
    status: 404,
    description: 'Item or image not found'
  })
  async getItemImage(
    @Param('id') id: string,
    @Param('type') type: string,
    @Res() res: Response,
    @Query('width') width?: string,
    @Query('height') height?: string
  ) {
    // Get the item to check if it exists and get jellyfinId
    const item = await this.databaseService.item.findUnique({
      where: { id },
      select: {
        id: true,
        jellyfinId: true,
        hasArtwork: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    if (!item.hasArtwork) {
      throw new NotFoundException('Item has no artwork');
    }

    try {
      // Use the existing downloadArtwork method
      const imageBuffer = await this.jellyfinService.downloadArtwork(
        item.jellyfinId,
        type
      );

      // Set appropriate headers
      res.set({
        'Content-Type': 'image/jpeg', // Default to JPEG
        'Cache-Control': 'public, max-age=86400', // Cache for 1 day
      });

      // Send the image data
      res.send(imageBuffer);
    } catch (error) {
      throw new NotFoundException('Image not found or unavailable');
    }
  }
}
