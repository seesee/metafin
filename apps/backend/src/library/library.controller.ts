import { Controller, Post, Get, Body, Query, Param } from '@nestjs/common';
import { LibrarySyncService, SyncProgress } from './library-sync.service.js';
import { DatabaseService } from '../database/database.service.js';

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

@Controller('api/library')
export class LibraryController {
  constructor(
    private readonly librarySyncService: LibrarySyncService,
    private readonly databaseService: DatabaseService
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
}
