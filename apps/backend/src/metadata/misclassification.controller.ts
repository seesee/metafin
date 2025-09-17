import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  ParseIntPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { MisclassificationService } from './misclassification.service.js';

@Controller('api/misclassifications')
export class MisclassificationController {
  constructor(
    private readonly misclassificationService: MisclassificationService
  ) {}

  @Get()
  async getMisclassifiedItems(
    @Query('library') libraryId?: string,
    @Query('severity') severityFilter?: 'low' | 'medium' | 'high',
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
    @Query('offset', new ParseIntPipe({ optional: true })) offset = 0
  ) {
    const items = await this.misclassificationService.getMisclassifiedItems(
      libraryId,
      severityFilter,
      limit,
      offset
    );

    return {
      items,
      pagination: {
        limit,
        offset,
        hasMore: items.length === limit,
      },
    };
  }

  @Get(':itemId/analysis')
  async analyzeItem(@Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.misclassificationService.analyzeItem(itemId);
  }

  @Post('scan')
  async scanLibrary(
    @Query('library') libraryId?: string,
    @Query('types') itemTypes?: string
  ) {
    const typeArray = itemTypes ? itemTypes.split(',') : undefined;
    return this.misclassificationService.scanLibraryForMisclassifications(
      libraryId,
      typeArray
    );
  }

  @Delete(':itemId')
  async dismissMisclassification(
    @Param('itemId', ParseUUIDPipe) itemId: string
  ) {
    await this.misclassificationService.dismissMisclassification(itemId);
    return { success: true, message: 'Misclassification dismissed' };
  }
}
