import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { BulkOperationsService } from './services/bulk-operations.service';
import {
  BulkOperationRequest,
  OperationPreviewResponse,
  ExecuteOperationRequest,
  ExecuteOperationResponse,
  JobStatusResponse,
} from './dto/bulk-operation.dto';

@ApiTags('operations')
@Controller('api/operations')
@UsePipes(new ValidationPipe({ transform: true }))
export class OperationsController {
  constructor(private readonly bulkOperationsService: BulkOperationsService) {}

  @Post('preview')
  @ApiOperation({
    summary: 'Generate preview of bulk operation',
    description: 'Accepts an operation specification and returns per-item diffs and API call counts',
  })
  @ApiResponse({
    status: 200,
    description: 'Preview generated successfully',
    type: OperationPreviewResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid operation specification',
  })
  async generatePreview(
    @Body() request: BulkOperationRequest,
  ): Promise<OperationPreviewResponse> {
    return this.bulkOperationsService.generatePreview(request);
  }

  @Post('execute')
  @ApiOperation({
    summary: 'Execute bulk operation',
    description: 'Accepts a preview token and executes operations in batches with concurrency limits and retries',
  })
  @ApiResponse({
    status: 200,
    description: 'Operation execution started',
    type: ExecuteOperationResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired preview token',
  })
  async executeOperation(
    @Body() request: ExecuteOperationRequest,
  ): Promise<ExecuteOperationResponse> {
    return this.bulkOperationsService.executeOperation(request);
  }

  @Get('jobs/:id')
  @ApiOperation({
    summary: 'Get job status',
    description: 'Returns job status and per-item results for monitoring bulk operation progress',
  })
  @ApiParam({
    name: 'id',
    description: 'Job ID',
    type: 'string',
  })
  @ApiQuery({
    name: 'includeDetails',
    description: 'Include operation logs and detailed results',
    required: false,
    type: 'boolean',
  })
  @ApiResponse({
    status: 200,
    description: 'Job status retrieved successfully',
    type: JobStatusResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
  })
  async getJobStatus(
    @Param('id') jobId: string,
    @Query('includeDetails') includeDetails?: boolean,
  ): Promise<JobStatusResponse> {
    return this.bulkOperationsService.getJobStatus(jobId, includeDetails);
  }

  @Get('jobs')
  @ApiOperation({
    summary: 'List recent jobs',
    description: 'Returns a list of recent bulk operation jobs',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of jobs to return',
    required: false,
    type: 'number',
  })
  @ApiQuery({
    name: 'type',
    description: 'Filter by job type',
    required: false,
    type: 'string',
  })
  @ApiQuery({
    name: 'status',
    description: 'Filter by job status',
    required: false,
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Jobs retrieved successfully',
    type: [JobStatusResponse],
  })
  async listJobs(
    @Query('limit') limit = 20,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ): Promise<JobStatusResponse[]> {
    return this.bulkOperationsService.listJobs({
      limit: Math.min(limit, 100), // Cap at 100
      type,
      status,
    });
  }
}