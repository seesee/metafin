import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { JellyfinService } from '../../jellyfin/jellyfin.service.js';

interface ConfigurationData {
  jellyfin: {
    url: string;
    apiKey: string;
  };
  tmdb: {
    apiKey: string;
  };
  providers: {
    [key: string]: {
      enabled: boolean;
      rateLimit: number;
      timeout: number;
    };
  };
}

interface TestResult {
  success: boolean;
  message: string;
  details?: any;
}

@Injectable()
export class ConfigurationService {
  private readonly logger = new Logger(ConfigurationService.name);
  private configPath: string;
  private currentConfig: Partial<ConfigurationData> = {};

  constructor(
    private readonly configService: ConfigService,
    private readonly jellyfinService: JellyfinService,
  ) {
    // Use a configuration file in the data directory
    const dataDir = process.env.DATA_DIR || './data';
    this.configPath = path.join(dataDir, 'config.json');
    this.loadConfigFromFile();
  }

  private async loadConfigFromFile() {
    try {
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      const configData = await fs.readFile(this.configPath, 'utf-8');
      this.currentConfig = JSON.parse(configData);
      this.logger.log('Configuration loaded from file');
    } catch (error) {
      // File doesn't exist or is invalid, start with empty config
      this.logger.log('No existing configuration file found, starting fresh');
      this.currentConfig = {};
    }
  }

  private async saveConfigToFile() {
    try {
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      await fs.writeFile(this.configPath, JSON.stringify(this.currentConfig, null, 2));
      this.logger.log('Configuration saved to file');
    } catch (error) {
      this.logger.error('Failed to save configuration to file', error);
      throw error;
    }
  }

  async getConfiguration(): Promise<ConfigurationData> {
    // Merge current config with environment variables (env takes precedence)
    return {
      jellyfin: {
        url: process.env.JELLYFIN_URL || this.currentConfig.jellyfin?.url || '',
        apiKey: process.env.JELLYFIN_API_KEY || this.currentConfig.jellyfin?.apiKey || '',
      },
      tmdb: {
        apiKey: process.env.TMDB_API_KEY || this.currentConfig.tmdb?.apiKey || '',
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
          enabled: !!(process.env.TMDB_API_KEY || this.currentConfig.tmdb?.apiKey),
          rateLimit: 40,
          timeout: 30000,
        },
        ...this.currentConfig.providers,
      },
    };
  }

  async updateConfiguration(updates: any): Promise<{
    updated: string[];
    requiresRestart: boolean;
  }> {
    const updated: string[] = [];
    let requiresRestart = false;

    // Update jellyfin configuration
    if (updates.jellyfin) {
      if (!this.currentConfig.jellyfin) {
        this.currentConfig.jellyfin = { url: '', apiKey: '' };
      }

      if (updates.jellyfin.url && updates.jellyfin.url !== this.currentConfig.jellyfin.url) {
        this.currentConfig.jellyfin.url = updates.jellyfin.url;
        updated.push('jellyfin.url');
        requiresRestart = true; // URL changes require restart for now
      }

      if (updates.jellyfin.apiKey && updates.jellyfin.apiKey !== this.currentConfig.jellyfin.apiKey) {
        this.currentConfig.jellyfin.apiKey = updates.jellyfin.apiKey;
        updated.push('jellyfin.apiKey');
        // API key changes can be hot-reloaded
      }
    }

    // Update TMDB configuration
    if (updates.tmdb?.apiKey) {
      if (!this.currentConfig.tmdb) {
        this.currentConfig.tmdb = { apiKey: '' };
      }

      if (updates.tmdb.apiKey !== this.currentConfig.tmdb.apiKey) {
        this.currentConfig.tmdb.apiKey = updates.tmdb.apiKey;
        updated.push('tmdb.apiKey');
        // TMDB key changes can be hot-reloaded
      }
    }

    // Update provider configuration
    if (updates.providers) {
      if (!this.currentConfig.providers) {
        this.currentConfig.providers = {};
      }

      for (const [providerName, providerConfig] of Object.entries(updates.providers)) {
        if (!this.currentConfig.providers[providerName]) {
          this.currentConfig.providers[providerName] = {
            enabled: true,
            rateLimit: 10,
            timeout: 30000,
          };
        }

        const config = providerConfig as any;
        if (config.enabled !== undefined) {
          this.currentConfig.providers[providerName].enabled = config.enabled;
          updated.push(`providers.${providerName}.enabled`);
        }
        if (config.rateLimit !== undefined) {
          this.currentConfig.providers[providerName].rateLimit = config.rateLimit;
          updated.push(`providers.${providerName}.rateLimit`);
        }
        if (config.timeout !== undefined) {
          this.currentConfig.providers[providerName].timeout = config.timeout;
          updated.push(`providers.${providerName}.timeout`);
        }
      }
    }

    // Save the updated configuration
    await this.saveConfigToFile();

    this.logger.log(`Configuration updated: ${updated.join(', ')}`);
    if (requiresRestart) {
      this.logger.warn('Some changes require a restart to take effect');
    }

    return { updated, requiresRestart };
  }

  async testConnection(service: 'jellyfin' | 'tmdb', config: any): Promise<TestResult> {
    try {
      if (service === 'jellyfin') {
        // Test Jellyfin connection
        if (!config.url || !config.apiKey) {
          return {
            success: false,
            message: 'Jellyfin URL and API key are required',
          };
        }

        // Create a temporary jellyfin service with new config
        const testResult = await this.testJellyfinConnection(config.url, config.apiKey);
        return testResult;
      }

      if (service === 'tmdb') {
        // Test TMDB connection
        if (!config.apiKey) {
          return {
            success: false,
            message: 'TMDB API key is required',
          };
        }

        const testResult = await this.testTmdbConnection(config.apiKey);
        return testResult;
      }

      return {
        success: false,
        message: `Unknown service: ${service}`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  private async testJellyfinConnection(url: string, apiKey: string): Promise<TestResult> {
    try {
      // Make a direct HTTP request to test the connection
      const testUrl = `${url.replace(/\/$/, '')}/System/Info`;
      const response = await fetch(testUrl, {
        headers: {
          'Authorization': `MediaBrowser Token="${apiKey}"`,
          'X-Emby-Authorization': `MediaBrowser Token="${apiKey}"`,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const systemInfo = await response.json();
      return {
        success: true,
        message: `Connected to ${(systemInfo as any).ServerName || 'Jellyfin'} v${(systemInfo as any).Version}`,
        details: {
          serverName: (systemInfo as any).ServerName,
          version: (systemInfo as any).Version,
          operatingSystem: (systemInfo as any).OperatingSystem,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  private async testTmdbConnection(apiKey: string): Promise<TestResult> {
    try {
      // Test TMDB connection with configuration endpoint
      const testUrl = `https://api.themoviedb.org/3/configuration?api_key=${apiKey}`;
      const response = await fetch(testUrl);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: (errorData as any).status_message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const config = await response.json();
      return {
        success: true,
        message: 'Successfully connected to TMDB API',
        details: {
          baseUrl: (config as any).images?.base_url,
          posterSizes: (config as any).images?.poster_sizes,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'TMDB connection failed',
      };
    }
  }

  async reloadConfiguration(): Promise<{ reloaded: string[] }> {
    try {
      // Reload configuration from file
      await this.loadConfigFromFile();

      const reloaded: string[] = [];

      // Update Jellyfin service with new configuration if available
      const config = await this.getConfiguration();

      if (config.jellyfin.apiKey && config.jellyfin.apiKey !== process.env.JELLYFIN_API_KEY) {
        // In a real implementation, you'd update the JellyfinService here
        // For now, we'll just log that it would be updated
        this.logger.log('Would update Jellyfin service with new API key');
        reloaded.push('jellyfin');
      }

      if (config.tmdb.apiKey && config.tmdb.apiKey !== process.env.TMDB_API_KEY) {
        // Update TMDB configuration
        this.logger.log('Would update TMDB configuration');
        reloaded.push('tmdb');
      }

      this.logger.log(`Configuration reloaded: ${reloaded.join(', ')}`);
      return { reloaded };
    } catch (error) {
      this.logger.error('Failed to reload configuration', error);
      throw error;
    }
  }
}