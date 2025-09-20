import { Module } from '@nestjs/common';
import { OperationsController } from './operations.controller';
import { BulkOperationsService } from './services/bulk-operations.service';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [DatabaseModule, CommonModule],
  controllers: [OperationsController],
  providers: [BulkOperationsService],
  exports: [BulkOperationsService],
})
export class OperationsModule {}