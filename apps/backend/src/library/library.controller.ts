import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Query,
  Param,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LibrarySyncService, SyncProgress } from './library-sync.service.js';
import { DatabaseService } from '../database/database.service.js';
import { JellyfinService } from '../jellyfin/jellyfin.service.js';

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
}

export interface ApplyArtworkRequest {
  candidateId: string;
  type: string;
}

export interface SearchArtworkRequest {
  query?: string;
  year?: number;
  language?: string;
}

@Controller('api/library')
export class LibraryController {
  constructor(
    private readonly librarySyncService: LibrarySyncService,
    private readonly databaseService: DatabaseService,
    private readonly jellyfinService: JellyfinService
  ) {}

  @Post('sync')
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
  async getLibraryItems(@Query() query: LibraryItemsQuery) {
    const page = parseInt(String(query.page || '1'));
    const limit = Math.min(parseInt(String(query.limit || '24')), 100);
    const offset = (page - 1) * limit;

    // Build where clause based on filters
    const where: Record<string, unknown> = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { overview: { contains: query.search, mode: 'insensitive' } },
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
      items,
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

    return item;
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

    // Try to update Jellyfin item (non-blocking)
    try {
      await this.jellyfinService.updateItemMetadata(
        currentItem.jellyfinId,
        updateData
      );
    } catch (error) {
      // Log the error but don't fail the request
      console.warn(
        `Failed to update Jellyfin item ${currentItem.jellyfinId}:`,
        (error as Error).message
      );
    }

    return updatedItem;
  }

  @Get('items/:id/artwork')
  async getArtworkCandidates(@Param('id') id: string) {
    const artwork = await this.databaseService.artworkCandidate.findMany({
      where: { itemId: id },
      orderBy: [
        { isApplied: 'desc' },
        { confidence: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return artwork;
  }

  @Post('items/:id/artwork/apply')
  async applyArtwork(
    @Param('id') id: string,
    @Body() applyData: ApplyArtworkRequest
  ) {
    // First, get the artwork candidate
    const candidate = await this.databaseService.artworkCandidate.findUnique({
      where: { id: applyData.candidateId },
    });

    if (!candidate) {
      throw new Error('Artwork candidate not found');
    }

    if (candidate.itemId !== id) {
      throw new Error('Artwork candidate does not belong to this item');
    }

    // Get the item to verify it exists and get jellyfinId
    const item = await this.databaseService.item.findUnique({
      where: { id },
      select: { id: true, jellyfinId: true },
    });

    if (!item) {
      throw new Error('Item not found');
    }

    try {
      // Apply the artwork to Jellyfin
      await this.jellyfinService.applyItemArtwork(
        item.jellyfinId,
        candidate.type,
        candidate.url
      );

      // Mark this candidate as applied and unmark others of the same type
      await this.databaseService.$transaction([
        // Unmark all other candidates of the same type for this item
        this.databaseService.artworkCandidate.updateMany({
          where: {
            itemId: id,
            type: candidate.type,
          },
          data: {
            isApplied: false,
          },
        }),
        // Mark this candidate as applied
        this.databaseService.artworkCandidate.update({
          where: { id: applyData.candidateId },
          data: {
            isApplied: true,
            appliedAt: new Date(),
          },
        }),
        // Update the item's hasArtwork flag
        this.databaseService.item.update({
          where: { id },
          data: {
            hasArtwork: true,
            lastSyncAt: new Date(),
          },
        }),
      ]);

      return {
        message: 'Artwork applied successfully',
        candidateId: applyData.candidateId,
      };
    } catch (error) {
      console.error('Failed to apply artwork:', error);
      throw new Error(`Failed to apply artwork: ${(error as Error).message}`);
    }
  }

  @Post('items/:id/artwork/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCustomArtwork(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadData: { type: string }
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(
        'Invalid file type. Only JPEG, PNG, and WebP are allowed.'
      );
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error('File size too large. Maximum size is 10MB.');
    }

    // Get the item to verify it exists and get jellyfinId
    const item = await this.databaseService.item.findUnique({
      where: { id },
      select: { id: true, jellyfinId: true },
    });

    if (!item) {
      throw new Error('Item not found');
    }

    try {
      // Upload the artwork to Jellyfin
      await this.jellyfinService.uploadItemArtwork(
        item.jellyfinId,
        uploadData.type || 'Primary',
        file.buffer,
        file.mimetype
      );

      // Update the item's hasArtwork flag
      await this.databaseService.item.update({
        where: { id },
        data: {
          hasArtwork: true,
          lastSyncAt: new Date(),
        },
      });

      return {
        message: 'Custom artwork uploaded successfully',
        type: uploadData.type || 'Primary',
      };
    } catch (error) {
      console.error('Failed to upload custom artwork:', error);
      throw new Error(`Failed to upload artwork: ${(error as Error).message}`);
    }
  }

  @Post('items/:id/artwork/search')
  async searchArtwork(
    @Param('id') id: string,
    @Body() searchData: SearchArtworkRequest
  ) {
    // Get the item to determine search parameters
    const item = await this.databaseService.item.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        year: true,
        jellyfinId: true,
      },
    });

    if (!item) {
      throw new Error('Item not found');
    }

    const query = searchData.query || item.name;
    const year = searchData.year || item.year;
    const language = searchData.language || 'en';

    try {
      // For now, create mock artwork candidates based on the search
      // In a real implementation, this would call external providers like TVMaze, TMDb, etc.
      const mockCandidates = [
        {
          type: 'Primary',
          url: `https://via.placeholder.com/400x600/1e40af/ffffff?text=${encodeURIComponent(query)}-Poster-1`,
          width: 400,
          height: 600,
          provider: 'TVMaze',
          confidence: 0.95,
        },
        {
          type: 'Primary',
          url: `https://via.placeholder.com/400x600/7c2d12/ffffff?text=${encodeURIComponent(query)}-Poster-2`,
          width: 400,
          height: 600,
          provider: 'TMDb',
          confidence: 0.88,
        },
        {
          type: 'Backdrop',
          url: `https://via.placeholder.com/800x450/dc2626/ffffff?text=${encodeURIComponent(query)}-Backdrop`,
          width: 800,
          height: 450,
          provider: 'TVMaze',
          confidence: 0.92,
        },
        {
          type: 'Logo',
          url: `https://via.placeholder.com/300x100/059669/ffffff?text=${encodeURIComponent(query)}-Logo`,
          width: 300,
          height: 100,
          provider: 'TMDb',
          confidence: 0.85,
        },
      ];

      // Save artwork candidates to database
      const savedCandidates = await Promise.all(
        mockCandidates.map(async (candidate) => {
          // Check if this candidate already exists
          const existing =
            await this.databaseService.artworkCandidate.findFirst({
              where: {
                itemId: id,
                url: candidate.url,
                type: candidate.type,
              },
            });

          if (existing) {
            return existing;
          }

          // Create new candidate
          return this.databaseService.artworkCandidate.create({
            data: {
              itemId: id,
              type: candidate.type,
              url: candidate.url,
              width: candidate.width,
              height: candidate.height,
              provider: candidate.provider,
              confidence: candidate.confidence,
              isApplied: false,
            },
          });
        })
      );

      return {
        message: `Found ${savedCandidates.length} artwork candidates`,
        candidates: savedCandidates,
        searchQuery: query,
        searchYear: year,
        searchLanguage: language,
      };
    } catch (error) {
      console.error('Failed to search for artwork:', error);
      throw new Error(
        `Failed to search for artwork: ${(error as Error).message}`
      );
    }
  }
}
