import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { ConfigurationService } from './configuration.service';
import { JellyfinService } from '../../jellyfin/jellyfin.service';
import * as fs from 'fs/promises';
import * as path from 'path';

jest.mock('fs/promises');
jest.mock('../../jellyfin/jellyfin.service', () => ({
  JellyfinService: jest.fn().mockImplementation(() => ({
    testConnection: jest.fn(),
  })),
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('ConfigurationService', () => {
  let service: ConfigurationService;
  let mockJellyfinService: jest.Mocked<JellyfinService>;
  let configService: ConfigService;
  let tempConfigPath: string;

  const mockConfigData = {
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
    },
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    mockFs.readFile.mockReset();
    mockFs.writeFile.mockReset();
    mockFs.mkdir.mockReset();

    // Mock JellyfinService
    mockJellyfinService = {
      testConnection: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [
            () => ({
              DATA_DIR: '/tmp/test-config',
            }),
          ],
        }),
      ],
      providers: [
        ConfigurationService,
        {
          provide: JellyfinService,
          useValue: mockJellyfinService,
        },
      ],
    }).compile();

    service = module.get<ConfigurationService>(ConfigurationService);
    configService = module.get<ConfigService>(ConfigService);
    tempConfigPath = path.join('/tmp/test-config', 'config.json');

    // Mock file system operations
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  describe('constructor and initialization', () => {
    it('should load configuration from file if it exists', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockConfigData));

      const module: TestingModule = await Test.createTestingModule({
        imports: [ConfigModule.forRoot()],
        providers: [
          ConfigurationService,
          {
            provide: JellyfinService,
            useValue: mockJellyfinService,
          },
        ],
      }).compile();

      const testService = module.get<ConfigurationService>(ConfigurationService);

      // Allow the constructor to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockFs.readFile).toHaveBeenCalled();
    });

    it('should handle missing configuration file gracefully', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('File not found'));

      const module: TestingModule = await Test.createTestingModule({
        imports: [ConfigModule.forRoot()],
        providers: [
          ConfigurationService,
          {
            provide: JellyfinService,
            useValue: mockJellyfinService,
          },
        ],
      }).compile();

      const testService = module.get<ConfigurationService>(ConfigurationService);

      // Should not throw error
      expect(testService).toBeDefined();
    });
  });

  describe('getConfiguration', () => {
    it('should return configuration with environment variable precedence', async () => {
      // Set environment variables
      process.env.JELLYFIN_URL = 'https://env.jellyfin.com';
      process.env.JELLYFIN_API_KEY = 'env-jellyfin-key';
      process.env.TMDB_API_KEY = 'env-tmdb-key';

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockConfigData));

      const config = await service.getConfiguration();

      expect(config.jellyfin.url).toBe('https://env.jellyfin.com');
      expect(config.jellyfin.apiKey).toBe('env-jellyfin-key');
      expect(config.tmdb.apiKey).toBe('env-tmdb-key');
      expect(config.providers.tvmaze.enabled).toBe(true);

      // Clean up environment variables
      delete process.env.JELLYFIN_URL;
      delete process.env.JELLYFIN_API_KEY;
      delete process.env.TMDB_API_KEY;
    });

    it('should return default provider configuration', async () => {
      const config = await service.getConfiguration();

      expect(config.providers).toHaveProperty('tvmaze');
      expect(config.providers).toHaveProperty('wikidata');
      expect(config.providers).toHaveProperty('tmdb');
      expect(config.providers.tvmaze.enabled).toBe(true);
      expect(config.providers.wikidata.enabled).toBe(true);
      expect(config.providers.tmdb.enabled).toBe(false); // No API key
    });
  });

  describe('updateConfiguration', () => {
    beforeEach(() => {
      mockFs.readFile.mockResolvedValue('{}'); // Start with empty config
    });

    it('should save and update Jellyfin configuration', async () => {
      const updates = {
        jellyfin: {
          url: 'https://new.jellyfin.com',
          apiKey: 'new-jellyfin-key',
        },
      };

      const result = await service.updateConfiguration(updates);

      expect(result.updated).toContain('jellyfin.url');
      expect(result.updated).toContain('jellyfin.apiKey');
      expect(result.requiresRestart).toBe(true); // URL changes require restart
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('new.jellyfin.com'),
      );
    });

    it('should save and update TMDb configuration without restart', async () => {
      const updates = {
        tmdb: {
          apiKey: 'new-tmdb-key',
        },
      };

      const result = await service.updateConfiguration(updates);

      expect(result.updated).toContain('tmdb.apiKey');
      expect(result.requiresRestart).toBe(false); // API key changes don't require restart
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('new-tmdb-key'),
      );
    });

    it('should update provider configuration', async () => {
      const updates = {
        providers: {
          tvmaze: {
            enabled: false,
            rateLimit: 5,
          },
          custom: {
            enabled: true,
            rateLimit: 10,
            timeout: 60000,
          },
        },
      };

      const result = await service.updateConfiguration(updates);

      expect(result.updated).toContain('providers.tvmaze.enabled');
      expect(result.updated).toContain('providers.tvmaze.rateLimit');
      expect(result.updated).toContain('providers.custom.enabled');
      expect(result.updated).toContain('providers.custom.rateLimit');
      expect(result.updated).toContain('providers.custom.timeout');
    });

    it('should only update changed values', async () => {
      // Pre-populate with existing config
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        jellyfin: {
          url: 'https://existing.jellyfin.com',
          apiKey: 'existing-key',
        },
      }));

      const updates = {
        jellyfin: {
          url: 'https://existing.jellyfin.com', // Same value
          apiKey: 'new-key', // Different value
        },
      };

      const result = await service.updateConfiguration(updates);

      expect(result.updated).not.toContain('jellyfin.url');
      expect(result.updated).toContain('jellyfin.apiKey');
    });

    it('should handle file write errors', async () => {
      mockFs.writeFile.mockRejectedValueOnce(new Error('Permission denied'));

      const updates = {
        jellyfin: {
          url: 'https://test.jellyfin.com',
        },
      };

      await expect(service.updateConfiguration(updates)).rejects.toThrow('Permission denied');
    });
  });

  describe('testConnection', () => {
    beforeEach(() => {
      // Mock global fetch
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should test Jellyfin connection successfully', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          ServerName: 'Test Jellyfin',
          Version: '10.10.7',
          OperatingSystem: 'Linux',
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await service.testConnection('jellyfin', {
        url: 'https://test.jellyfin.com',
        apiKey: 'test-key',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Test Jellyfin');
      expect(result.details.serverName).toBe('Test Jellyfin');
      expect(result.details.version).toBe('10.10.7');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.jellyfin.com/System/Info',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'MediaBrowser Token="test-key"',
          }),
        }),
      );
    });

    it('should handle Jellyfin connection failure', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await service.testConnection('jellyfin', {
        url: 'https://test.jellyfin.com',
        apiKey: 'invalid-key',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('401');
    });

    it('should test TMDb connection successfully', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          images: {
            base_url: 'https://image.tmdb.org/t/p/',
            poster_sizes: ['w92', 'w154', 'w185'],
          },
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await service.testConnection('tmdb', {
        apiKey: 'test-tmdb-key',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('TMDB API');
      expect(result.details.baseUrl).toBe('https://image.tmdb.org/t/p/');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.themoviedb.org/3/configuration?api_key=test-tmdb-key',
      );
    });

    it('should handle TMDb connection failure', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: jest.fn().mockResolvedValue({
          status_message: 'Invalid API key',
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await service.testConnection('tmdb', {
        apiKey: 'invalid-key',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid API key');
    });

    it('should require URL and API key for Jellyfin', async () => {
      const result = await service.testConnection('jellyfin', {
        url: '',
        apiKey: 'test-key',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('required');
    });

    it('should require API key for TMDb', async () => {
      const result = await service.testConnection('tmdb', {
        apiKey: '',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('required');
    });

    it('should handle unknown service', async () => {
      const result = await service.testConnection('unknown' as any, {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown service');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await service.testConnection('jellyfin', {
        url: 'https://test.jellyfin.com',
        apiKey: 'test-key',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Network error');
    });
  });

  describe('reloadConfiguration', () => {
    it('should reload configuration from file', async () => {
      const newConfig = {
        jellyfin: {
          url: 'https://reloaded.jellyfin.com',
          apiKey: 'reloaded-key',
        },
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(newConfig));

      // Mock environment variables for comparison
      process.env.JELLYFIN_API_KEY = 'env-key';

      const result = await service.reloadConfiguration();

      expect(result.reloaded).toContain('jellyfin');
      expect(mockFs.readFile).toHaveBeenCalled();

      // Clean up
      delete process.env.JELLYFIN_API_KEY;
    });

    it('should handle reload errors', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('File read error'));

      await expect(service.reloadConfiguration()).rejects.toThrow('File read error');
    });
  });
});