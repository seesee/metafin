import { Controller, Get, Put, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigurationService } from './configuration.service.js';

export interface ConfigurationDto {
  jellyfin?: {
    url?: string;
    apiKey?: string;
  };
  tmdb?: {
    apiKey?: string;
  };
  providers?: {
    [key: string]: {
      enabled?: boolean;
      rateLimit?: number;
      timeout?: number;
    };
  };
}

@Controller('api/configuration')
export class ConfigurationController {
  constructor(private readonly configurationService: ConfigurationService) {}

  @Get()
  async getConfiguration() {
    try {
      return await this.configurationService.getConfiguration();
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put()
  async updateConfiguration(@Body() configDto: ConfigurationDto) {
    try {
      const result = await this.configurationService.updateConfiguration(configDto);
      return {
        success: true,
        message: 'Configuration updated successfully',
        updated: result.updated,
        requiresRestart: result.requiresRestart,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to update configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('test-connection')
  async testConnection(@Body() testDto: { service: 'jellyfin' | 'tmdb'; config: any }) {
    try {
      const result = await this.configurationService.testConnection(testDto.service, testDto.config);
      return {
        success: result.success,
        message: result.message,
        details: result.details,
      };
    } catch (error) {
      throw new HttpException(
        `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('reload')
  async reloadConfiguration() {
    try {
      const result = await this.configurationService.reloadConfiguration();
      return {
        success: true,
        message: 'Configuration reloaded successfully',
        reloaded: result.reloaded,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to reload configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}