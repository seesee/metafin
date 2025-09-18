import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigurationController, ConfigurationDto } from './configuration.controller';
import { ConfigurationService } from './configuration.service';

describe('ConfigurationController', () => {
  let controller: ConfigurationController;
  let mockConfigurationService: jest.Mocked<ConfigurationService>;

  const mockConfiguration = {
    jellyfin: {
      url: 'https://test.jellyfin.com',
      apiKey: 'test-jellyfin-key',
    },
    tmdb: {
      apiKey: 'test-tmdb-key',
    },
    providers: {
      tvmaze: {
        enabled: true,
        rateLimit: 1,
        timeout: 30000,
      },
      wikidata: {
        enabled: true,
        rateLimit: 5,
        timeout: 30000,
      },
      tmdb: {
        enabled: true,
        rateLimit: 40,
        timeout: 30000,
      },
    },
  };

  beforeEach(async () => {
    mockConfigurationService = {
      getConfiguration: jest.fn(),
      updateConfiguration: jest.fn(),
      testConnection: jest.fn(),
      reloadConfiguration: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfigurationController],
      providers: [
        {
          provide: ConfigurationService,
          useValue: mockConfigurationService,
        },
      ],
    }).compile();

    controller = module.get<ConfigurationController>(ConfigurationController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getConfiguration', () => {
    it('should return configuration data including API keys and endpoints', async () => {
      mockConfigurationService.getConfiguration.mockResolvedValue(mockConfiguration);

      const result = await controller.getConfiguration();

      expect(result).toEqual(mockConfiguration);
      expect(result.jellyfin.url).toBe('https://test.jellyfin.com');
      expect(result.jellyfin.apiKey).toBe('test-jellyfin-key');
      expect(result.tmdb.apiKey).toBe('test-tmdb-key');
      expect(mockConfigurationService.getConfiguration).toHaveBeenCalledTimes(1);
    });

    it('should handle service errors and throw HttpException', async () => {
      const error = new Error('Configuration read failed');
      mockConfigurationService.getConfiguration.mockRejectedValue(error);

      await expect(controller.getConfiguration()).rejects.toThrow(
        new HttpException(
          'Failed to retrieve configuration: Configuration read failed',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });

    it('should handle unknown errors', async () => {
      mockConfigurationService.getConfiguration.mockRejectedValue('Unknown error');

      await expect(controller.getConfiguration()).rejects.toThrow(
        new HttpException(
          'Failed to retrieve configuration: Unknown error',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('updateConfiguration', () => {
    it('should save Jellyfin API key and endpoint URL successfully', async () => {
      const configDto: ConfigurationDto = {
        jellyfin: {
          url: 'https://new.jellyfin.com',
          apiKey: 'new-jellyfin-key',
        },
      };

      const updateResult = {
        updated: ['jellyfin.url', 'jellyfin.apiKey'],
        requiresRestart: true,
      };

      mockConfigurationService.updateConfiguration.mockResolvedValue(updateResult);

      const result = await controller.updateConfiguration(configDto);

      expect(result).toEqual({
        success: true,
        message: 'Configuration updated successfully',
        updated: ['jellyfin.url', 'jellyfin.apiKey'],
        requiresRestart: true,
      });
      expect(mockConfigurationService.updateConfiguration).toHaveBeenCalledWith(configDto);
      expect(mockConfigurationService.updateConfiguration).toHaveBeenCalledTimes(1);
    });

    it('should save TMDb API key successfully', async () => {
      const configDto: ConfigurationDto = {
        tmdb: {
          apiKey: 'new-tmdb-key',
        },
      };

      const updateResult = {
        updated: ['tmdb.apiKey'],
        requiresRestart: false,
      };

      mockConfigurationService.updateConfiguration.mockResolvedValue(updateResult);

      const result = await controller.updateConfiguration(configDto);

      expect(result).toEqual({
        success: true,
        message: 'Configuration updated successfully',
        updated: ['tmdb.apiKey'],
        requiresRestart: false,
      });
      expect(mockConfigurationService.updateConfiguration).toHaveBeenCalledWith(configDto);
    });

    it('should update provider configuration', async () => {
      const configDto: ConfigurationDto = {
        providers: {
          tvmaze: {
            enabled: false,
            rateLimit: 2,
          },
          custom: {
            enabled: true,
            rateLimit: 10,
            timeout: 60000,
          },
        },
      };

      const updateResult = {
        updated: [
          'providers.tvmaze.enabled',
          'providers.tvmaze.rateLimit',
          'providers.custom.enabled',
          'providers.custom.rateLimit',
          'providers.custom.timeout',
        ],
        requiresRestart: false,
      };

      mockConfigurationService.updateConfiguration.mockResolvedValue(updateResult);

      const result = await controller.updateConfiguration(configDto);

      expect(result.success).toBe(true);
      expect(result.updated).toEqual(updateResult.updated);
      expect(mockConfigurationService.updateConfiguration).toHaveBeenCalledWith(configDto);
    });

    it('should handle configuration update errors', async () => {
      const configDto: ConfigurationDto = {
        jellyfin: {
          url: 'invalid-url',
        },
      };

      const error = new Error('Invalid configuration');
      mockConfigurationService.updateConfiguration.mockRejectedValue(error);

      await expect(controller.updateConfiguration(configDto)).rejects.toThrow(
        new HttpException(
          'Failed to update configuration: Invalid configuration',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should handle unknown update errors', async () => {
      const configDto: ConfigurationDto = {
        jellyfin: {
          apiKey: 'test-key',
        },
      };

      mockConfigurationService.updateConfiguration.mockRejectedValue('Unknown error');

      await expect(controller.updateConfiguration(configDto)).rejects.toThrow(
        new HttpException(
          'Failed to update configuration: Unknown error',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });
  });

  describe('testConnection', () => {
    it('should test Jellyfin connection with provided API key and URL', async () => {
      const testDto = {
        service: 'jellyfin' as const,
        config: {
          url: 'https://test.jellyfin.com',
          apiKey: 'test-key',
        },
      };

      const testResult = {
        success: true,
        message: 'Connected to Test Jellyfin v10.10.7',
        details: {
          serverName: 'Test Jellyfin',
          version: '10.10.7',
          operatingSystem: 'Linux',
        },
      };

      mockConfigurationService.testConnection.mockResolvedValue(testResult);

      const result = await controller.testConnection(testDto);

      expect(result).toEqual({
        success: true,
        message: 'Connected to Test Jellyfin v10.10.7',
        details: {
          serverName: 'Test Jellyfin',
          version: '10.10.7',
          operatingSystem: 'Linux',
        },
      });
      expect(mockConfigurationService.testConnection).toHaveBeenCalledWith(
        'jellyfin',
        testDto.config,
      );
    });

    it('should test TMDb connection with provided API key', async () => {
      const testDto = {
        service: 'tmdb' as const,
        config: {
          apiKey: 'test-tmdb-key',
        },
      };

      const testResult = {
        success: true,
        message: 'Successfully connected to TMDB API',
        details: {
          baseUrl: 'https://image.tmdb.org/t/p/',
          posterSizes: ['w92', 'w154', 'w185'],
        },
      };

      mockConfigurationService.testConnection.mockResolvedValue(testResult);

      const result = await controller.testConnection(testDto);

      expect(result).toEqual(testResult);
      expect(mockConfigurationService.testConnection).toHaveBeenCalledWith(
        'tmdb',
        testDto.config,
      );
    });

    it('should handle failed Jellyfin connection test', async () => {
      const testDto = {
        service: 'jellyfin' as const,
        config: {
          url: 'https://invalid.jellyfin.com',
          apiKey: 'invalid-key',
        },
      };

      const testResult = {
        success: false,
        message: 'HTTP 401: Unauthorized',
      };

      mockConfigurationService.testConnection.mockResolvedValue(testResult);

      const result = await controller.testConnection(testDto);

      expect(result.success).toBe(false);
      expect(result.message).toContain('401');
      expect(mockConfigurationService.testConnection).toHaveBeenCalledWith(
        'jellyfin',
        testDto.config,
      );
    });

    it('should handle connection test errors', async () => {
      const testDto = {
        service: 'jellyfin' as const,
        config: {
          url: 'https://test.jellyfin.com',
          apiKey: 'test-key',
        },
      };

      const error = new Error('Network timeout');
      mockConfigurationService.testConnection.mockRejectedValue(error);

      await expect(controller.testConnection(testDto)).rejects.toThrow(
        new HttpException(
          'Connection test failed: Network timeout',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('should handle unknown connection test errors', async () => {
      const testDto = {
        service: 'tmdb' as const,
        config: {
          apiKey: 'test-key',
        },
      };

      mockConfigurationService.testConnection.mockRejectedValue('Unknown error');

      await expect(controller.testConnection(testDto)).rejects.toThrow(
        new HttpException(
          'Connection test failed: Unknown error',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });
  });

  describe('reloadConfiguration', () => {
    it('should reload configuration successfully', async () => {
      const reloadResult = {
        reloaded: ['jellyfin', 'tmdb'],
      };

      mockConfigurationService.reloadConfiguration.mockResolvedValue(reloadResult);

      const result = await controller.reloadConfiguration();

      expect(result).toEqual({
        success: true,
        message: 'Configuration reloaded successfully',
        reloaded: ['jellyfin', 'tmdb'],
      });
      expect(mockConfigurationService.reloadConfiguration).toHaveBeenCalledTimes(1);
    });

    it('should handle reload errors', async () => {
      const error = new Error('Failed to read configuration file');
      mockConfigurationService.reloadConfiguration.mockRejectedValue(error);

      await expect(controller.reloadConfiguration()).rejects.toThrow(
        new HttpException(
          'Failed to reload configuration: Failed to read configuration file',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });

    it('should handle unknown reload errors', async () => {
      mockConfigurationService.reloadConfiguration.mockRejectedValue('Unknown error');

      await expect(controller.reloadConfiguration()).rejects.toThrow(
        new HttpException(
          'Failed to reload configuration: Unknown error',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete configuration workflow - save and retrieve', async () => {
      // First, update configuration with new values
      const updateDto: ConfigurationDto = {
        jellyfin: {
          url: 'https://production.jellyfin.com',
          apiKey: 'production-api-key',
        },
        tmdb: {
          apiKey: 'production-tmdb-key',
        },
      };

      const updateResult = {
        updated: ['jellyfin.url', 'jellyfin.apiKey', 'tmdb.apiKey'],
        requiresRestart: true,
      };

      mockConfigurationService.updateConfiguration.mockResolvedValue(updateResult);

      const updateResponse = await controller.updateConfiguration(updateDto);

      expect(updateResponse.success).toBe(true);
      expect(updateResponse.updated).toContain('jellyfin.url');
      expect(updateResponse.updated).toContain('jellyfin.apiKey');
      expect(updateResponse.updated).toContain('tmdb.apiKey');

      // Then, retrieve the updated configuration
      const updatedConfig = {
        ...mockConfiguration,
        jellyfin: {
          url: 'https://production.jellyfin.com',
          apiKey: 'production-api-key',
        },
        tmdb: {
          apiKey: 'production-tmdb-key',
        },
      };

      mockConfigurationService.getConfiguration.mockResolvedValue(updatedConfig);

      const getResponse = await controller.getConfiguration();

      expect(getResponse.jellyfin.url).toBe('https://production.jellyfin.com');
      expect(getResponse.jellyfin.apiKey).toBe('production-api-key');
      expect(getResponse.tmdb.apiKey).toBe('production-tmdb-key');
    });

    it('should verify API key persistence across operations', async () => {
      // Save API keys
      const saveDto: ConfigurationDto = {
        jellyfin: {
          apiKey: 'persistent-jellyfin-key',
        },
        tmdb: {
          apiKey: 'persistent-tmdb-key',
        },
      };

      mockConfigurationService.updateConfiguration.mockResolvedValue({
        updated: ['jellyfin.apiKey', 'tmdb.apiKey'],
        requiresRestart: false,
      });

      await controller.updateConfiguration(saveDto);

      // Test connection with saved keys
      mockConfigurationService.testConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });

      const jellyfinTest = await controller.testConnection({
        service: 'jellyfin',
        config: { url: 'https://test.com', apiKey: 'persistent-jellyfin-key' },
      });

      const tmdbTest = await controller.testConnection({
        service: 'tmdb',
        config: { apiKey: 'persistent-tmdb-key' },
      });

      expect(jellyfinTest.success).toBe(true);
      expect(tmdbTest.success).toBe(true);

      // Verify service was called with correct API keys
      expect(mockConfigurationService.testConnection).toHaveBeenCalledWith(
        'jellyfin',
        { url: 'https://test.com', apiKey: 'persistent-jellyfin-key' },
      );
      expect(mockConfigurationService.testConnection).toHaveBeenCalledWith(
        'tmdb',
        { apiKey: 'persistent-tmdb-key' },
      );
    });
  });
});