import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { CollectionsService } from './collections.service.js';
import { DatabaseService } from '../database/database.service.js';

export interface CreateCollectionRequest {
  name: string;
  type?: string;
  itemIds: string[];
}

export interface UpdateCollectionRequest {
  name?: string;
  type?: string;
  addItemIds?: string[];
  removeItemIds?: string[];
}

export interface CollectionsQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Controller('api/collections')
export class CollectionsController {
  constructor(
    private readonly collectionsService: CollectionsService,
    private readonly databaseService: DatabaseService
  ) {}

  @Get()
  async getCollections(@Query() query: CollectionsQuery) {
    const page = parseInt(String(query.page || '1'));
    const limit = Math.min(parseInt(String(query.limit || '24')), 100);
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { overview: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Record<string, string> = {};
    if (query.sortBy) {
      orderBy[query.sortBy] = query.sortOrder || 'asc';
    } else {
      orderBy.name = 'asc';
    }

    const [collections, total] = await Promise.all([
      this.databaseService.collection.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          _count: {
            select: {
              items: true,
            },
          },
        },
      }),
      this.databaseService.collection.count({ where }),
    ]);

    return {
      collections: collections.map((collection) => ({
        id: collection.id,
        name: collection.name,
        type: collection.type,
        itemCount: collection._count.items,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Get(':id')
  async getCollection(@Param('id') id: string) {
    const collection = await this.databaseService.collection.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            item: {
              include: {
                library: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!collection) {
      throw new Error('Collection not found');
    }

    return {
      id: collection.id,
      name: collection.name,
      type: collection.type,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
      items: collection.items.map((collectionItem) => ({
        id: collectionItem.item.id,
        jellyfinId: collectionItem.item.jellyfinId,
        name: collectionItem.item.name,
        type: collectionItem.item.type,
        year: collectionItem.item.year,
        overview: collectionItem.item.overview,
        parentName: collectionItem.item.parentId ? 'Parent Item' : undefined,
        libraryName: collectionItem.item.library?.name,
        hasArtwork: collectionItem.item.hasArtwork,
        lastSyncAt: collectionItem.item.lastSyncAt,
      })),
    };
  }

  @Post()
  async createCollection(@Body() body: CreateCollectionRequest) {
    const collection = await this.collectionsService.createCollection({
      name: body.name,
      type: body.type || 'manual',
      itemIds: body.itemIds,
    });

    return {
      message: 'Collection created successfully',
      collection: {
        id: collection.id,
        name: collection.name,
        type: collection.type,
        itemCount: body.itemIds.length,
        createdAt: collection.createdAt,
      },
    };
  }

  @Put(':id')
  async updateCollection(
    @Param('id') id: string,
    @Body() body: UpdateCollectionRequest
  ) {
    const collection = await this.collectionsService.updateCollection(id, {
      name: body.name,
      type: body.type,
      addItemIds: body.addItemIds,
      removeItemIds: body.removeItemIds,
    });

    return {
      message: 'Collection updated successfully',
      collection: {
        id: collection.id,
        name: collection.name,
        type: collection.type,
        updatedAt: collection.updatedAt,
      },
    };
  }

  @Delete(':id')
  async deleteCollection(@Param('id') id: string) {
    await this.collectionsService.deleteCollection(id);

    return {
      message: 'Collection deleted successfully',
    };
  }

  @Post('bulk')
  async createBulkCollections(
    @Body() body: { collections: CreateCollectionRequest[] }
  ) {
    const results = await this.collectionsService.createBulkCollections(
      body.collections
    );

    return {
      message: `Created ${results.length} collections successfully`,
      collections: results.map((collection) => ({
        id: collection.id,
        name: collection.name,
        type: collection.type,
        createdAt: collection.createdAt,
      })),
    };
  }
}
