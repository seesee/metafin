import { Controller, Post, Get, Body } from '@nestjs/common';
import { LibrarySyncService, SyncProgress } from './library-sync.service.js';

export interface StartSyncRequest {
  fullSync?: boolean;
  libraryIds?: string[];
}

@Controller('api/library')
export class LibraryController {
  constructor(private readonly librarySyncService: LibrarySyncService) {}

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
}
