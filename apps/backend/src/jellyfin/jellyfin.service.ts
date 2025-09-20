import { Injectable } from '@nestjs/common';
import { ConfigService } from '../modules/config/config.service.js';
import { LoggerService } from '../modules/logger/logger.service.js';
import { AppError } from '@metafin/shared';
import type {
  JellyfinUser,
  JellyfinSystemInfo,
  JellyfinLibrary,
  JellyfinItem,
  JellyfinItemsQuery,
  JellyfinItemsResponse,
} from '@metafin/shared';

interface JellyfinResponse<T = unknown> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

@Injectable()
export class JellyfinService {
  private deviceId = 'metafin';
  private deviceName = 'metafin';
  private clientName = 'metafin';
  private version = '0.1.0';

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService
  ) {}

  private getHeaders(): Record<string, string> {
    const { apiKey } = this.config.requireJellyfinConfig();
    return {
      'X-Emby-Token': apiKey,
      'X-Emby-Authorization': `MediaBrowser Client="${this.clientName}", Device="${this.deviceName}", DeviceId="${this.deviceId}", Version="${this.version}"`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: unknown;
      params?: Record<string, string | number | boolean | undefined>;
    } = {}
  ): Promise<JellyfinResponse<T>> {
    const { method = 'GET', body, params } = options;
    const { url: baseUrl } = this.config.requireJellyfinConfig();
    const url = new URL(endpoint, baseUrl);

    // Add query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const requestOptions: RequestInit = {
      method,
      headers: this.getHeaders(),
    };

    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }

    try {
      this.logger.debug(
        `Jellyfin ${method} ${url.pathname}${url.search}`,
        'JellyfinService'
      );

      const response = await fetch(url.toString(), requestOptions);
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let responseData: T;
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        responseData = (await response.json()) as T;
      } else {
        responseData = (await response.text()) as T;
      }

      if (!response.ok) {
        this.logger.error(
          `Jellyfin API error: ${response.status} ${response.statusText}`,
          JSON.stringify(responseData),
          'JellyfinService'
        );

        throw AppError.jellyfinError(
          `Jellyfin API error: ${response.status} ${response.statusText}`,
          response.status,
          { endpoint, method, response: responseData }
        );
      }

      this.logger.debug(
        `Jellyfin ${method} ${url.pathname} completed: ${response.status}`,
        'JellyfinService'
      );

      return {
        data: responseData,
        status: response.status,
        headers: responseHeaders,
      };
    } catch (error) {
      if (AppError.isAppError(error)) {
        throw error;
      }

      this.logger.error(
        `Jellyfin request failed: ${error}`,
        error instanceof Error ? error.stack : undefined,
        'JellyfinService'
      );

      throw AppError.jellyfinError(
        `Failed to connect to Jellyfin: ${error instanceof Error ? error.message : 'Unknown error'}`,
        503,
        { endpoint, method, originalError: String(error) }
      );
    }
  }

  async getSystemInfo(): Promise<JellyfinSystemInfo> {
    const response = await this.request<JellyfinSystemInfo>('/System/Info');
    return response.data;
  }

  async getUsers(): Promise<JellyfinUser[]> {
    const response = await this.request<JellyfinUser[]>('/Users');
    return response.data;
  }

  async getLibraries(userId?: string): Promise<JellyfinLibrary[]> {
    const endpoint = userId
      ? `/Users/${userId}/Views`
      : '/Library/VirtualFolders';

    if (userId) {
      // /Users/{userId}/Views returns { Items: [...] }
      const response = await this.request<{ Items: JellyfinLibrary[] }>(endpoint);
      return response.data.Items || [];
    } else {
      // /Library/VirtualFolders returns [...] directly
      const response = await this.request<JellyfinLibrary[]>(endpoint);
      return response.data || [];
    }
  }

  async getItems(query: JellyfinItemsQuery): Promise<JellyfinItemsResponse> {
    const {
      userId,
      parentId,
      includeItemTypes,
      excludeItemTypes,
      recursive = true,
      fields,
      startIndex = 0,
      limit = 100,
      sortBy,
      sortOrder,
      filters,
      searchTerm,
    } = query;

    const params: Record<string, string | number | boolean | undefined> = {
      ParentId: parentId,
      IncludeItemTypes: includeItemTypes?.join(','),
      ExcludeItemTypes: excludeItemTypes?.join(','),
      Recursive: recursive,
      Fields: fields?.join(','),
      StartIndex: startIndex,
      Limit: limit,
      SortBy: sortBy?.join(','),
      SortOrder: sortOrder,
      Filters: filters?.join(','),
      SearchTerm: searchTerm,
    };

    const endpoint = userId ? `/Users/${userId}/Items` : '/Items';
    const response = await this.request<JellyfinItemsResponse>(endpoint, {
      params,
    });

    return response.data;
  }

  async getItem(itemId: string, userId?: string): Promise<JellyfinItem> {
    const endpoint = userId
      ? `/Users/${userId}/Items/${itemId}`
      : `/Items/${itemId}`;

    const response = await this.request<JellyfinItem>(endpoint);
    return response.data;
  }

  async updateItem(
    itemId: string,
    updates: Partial<JellyfinItem>
  ): Promise<void> {
    await this.request(`/Items/${itemId}`, {
      method: 'POST',
      body: updates,
    });
  }

  // Metadata write operations
  /**
   * Convert date string to Jellyfin's expected yyyy-MM-dd format
   */
  private formatDateForJellyfin(dateString?: string): string | undefined {
    if (!dateString) return undefined;

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return undefined;

      // Return only the date part in yyyy-MM-dd format
      return date.toISOString().split('T')[0];
    } catch (error) {
      this.logger.warn(`Failed to parse date string: ${dateString}`, error instanceof Error ? error.message : String(error));
      return undefined;
    }
  }

  /**
   * Alternative approach: Use the Metafin plugin for reliable metadata updates
   * This bypasses Jellyfin's problematic REST API by using our custom plugin
   */
  async writeMetadataViaPlugin(
    itemId: string,
    metadata: {
      name?: string;
      overview?: string;
      genres?: string[];
      tags?: string[];
      people?: Array<{ name: string; role?: string; type: string }>;
      studios?: string[];
      providerIds?: Record<string, string>;
      premiereDate?: string;
      endDate?: string;
      productionYear?: number;
      officialRating?: string;
      communityRating?: number;
    }
  ): Promise<void> {
    this.logger.log(
      `Updating metadata for item ${itemId} via Metafin plugin`,
      'JellyfinService'
    );

    try {
      // Prepare the request payload for the plugin
      const pluginPayload = {
        apiKey: this.config.requireJellyfinConfig().apiKey, // Use same API key
        name: metadata.name,
        overview: metadata.overview,
        productionYear: metadata.productionYear,
        officialRating: metadata.officialRating,
        communityRating: metadata.communityRating,
        premiereDate: metadata.premiereDate,
        endDate: metadata.endDate,
        genres: metadata.genres,
        tags: metadata.tags,
        studios: metadata.studios,
        providerIds: metadata.providerIds,
        refreshAfterUpdate: true
      };

      // Call the plugin's metadata endpoint
      const response = await this.request<{ Success: boolean; Message: string }>(`/metafin/items/${itemId}/metadata`, {
        method: 'POST',
        body: pluginPayload,
      });

      this.logger.log(
        `Successfully updated metadata via plugin for item ${itemId}`,
        'JellyfinService'
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Plugin metadata update failed for item ${itemId}`,
        error instanceof Error ? error.message : String(error),
        'JellyfinService'
      );
      throw error;
    }
  }

  /**
   * Fallback approach: Write metadata to .nfo file and trigger refresh
   * This is used when the plugin is not available
   */
  async writeMetadataViaFile(
    itemId: string,
    metadata: {
      name?: string;
      overview?: string;
      genres?: string[];
      tags?: string[];
      people?: Array<{ name: string; role?: string; type: string }>;
      studios?: string[];
      providerIds?: Record<string, string>;
      premiereDate?: string;
      endDate?: string;
      productionYear?: number;
      officialRating?: string;
      communityRating?: number;
    }
  ): Promise<void> {
    this.logger.log(
      `Attempting metadata update for item ${itemId} via fallback methods`,
      'JellyfinService'
    );

    // First try the plugin approach
    try {
      await this.writeMetadataViaPlugin(itemId, metadata);
      return; // Success - exit early
    } catch (pluginError) {
      this.logger.warn(
        `Plugin metadata update failed, falling back to refresh approach for item ${itemId}`,
        pluginError instanceof Error ? pluginError.message : String(pluginError),
        'JellyfinService'
      );
    }

    // Fallback to the old hybrid approach
    try {
      await this.updateItemMetadata(itemId, metadata);

      // If successful, trigger a refresh to ensure consistency
      await this.refreshMetadata(itemId, {
        metadataRefreshMode: 'Default',
        imageRefreshMode: 'None',
        replaceAllMetadata: false,
        replaceAllImages: false,
      });

      this.logger.log(
        `Metadata updated via fallback approach for item ${itemId}`,
        'JellyfinService'
      );
    } catch (error) {
      this.logger.warn(
        `All metadata update methods failed for item ${itemId}`,
        error instanceof Error ? error.message : String(error),
        'JellyfinService'
      );

      // Last resort: Just trigger a full refresh
      await this.refreshMetadata(itemId, {
        metadataRefreshMode: 'FullRefresh',
        imageRefreshMode: 'None',
        replaceAllMetadata: true,
        replaceAllImages: false,
      });

      // Re-throw the original error so caller knows the update didn't work
      throw error;
    }
  }

  private generateNfoContent(item: unknown, _metadata: unknown): string {
    // This would generate NFO XML content
    // For now, this is a placeholder since we can't write files directly
    return `<!-- NFO content for ${item.Name} -->`;
  }

  async updateItemMetadata(
    itemId: string,
    metadata: {
      name?: string;
      overview?: string;
      genres?: string[];
      tags?: string[];
      people?: Array<{ name: string; role?: string; type: string }>;
      studios?: string[];
      providerIds?: Record<string, string>;
      premiereDate?: string;
      endDate?: string;
      productionYear?: number;
      officialRating?: string;
      communityRating?: number;
    }
  ): Promise<void> {
    // Build partial update object with only the fields we want to change
    const updatePayload: Record<string, unknown> = {};

    if (metadata.name !== undefined) {
      updatePayload.Name = metadata.name;
    }
    if (metadata.overview !== undefined) {
      updatePayload.Overview = metadata.overview;
    }
    if (metadata.genres !== undefined) {
      updatePayload.Genres = metadata.genres;
    }
    if (metadata.tags !== undefined) {
      updatePayload.Tags = metadata.tags;
    }
    if (metadata.people !== undefined) {
      updatePayload.People = metadata.people.map((p) => ({
        Name: p.name,
        Role: p.role,
        Type: p.type,
      }));
    }
    if (metadata.studios !== undefined) {
      updatePayload.Studios = metadata.studios.map((s) => ({ Name: s }));
    }
    if (metadata.providerIds !== undefined) {
      updatePayload.ProviderIds = metadata.providerIds;
    }
    if (metadata.premiereDate !== undefined) {
      updatePayload.PremiereDate = this.formatDateForJellyfin(metadata.premiereDate);
    }
    if (metadata.endDate !== undefined) {
      updatePayload.EndDate = this.formatDateForJellyfin(metadata.endDate);
    }
    if (metadata.productionYear !== undefined) {
      updatePayload.ProductionYear = metadata.productionYear;
    }
    if (metadata.officialRating !== undefined) {
      updatePayload.OfficialRating = metadata.officialRating;
    }
    if (metadata.communityRating !== undefined) {
      updatePayload.CommunityRating = metadata.communityRating;
    }

    // Use the existing updateItem method for the actual API call
    await this.updateItem(itemId, updatePayload);
  }

  // Artwork operations
  async uploadArtwork(
    itemId: string,
    artworkType: string,
    imageData: Buffer,
    contentType: string
  ): Promise<void> {
    const url = `/Items/${itemId}/Images/${artworkType}`;

    const response = await fetch(
      new URL(url, this.config.requireJellyfinConfig().url).toString(),
      {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': contentType,
        },
        body: imageData,
      }
    );

    if (!response.ok) {
      throw AppError.jellyfinError(
        `Failed to upload ${artworkType} artwork: ${response.status} ${response.statusText}`,
        response.status,
        { itemId, artworkType }
      );
    }
  }

  async downloadArtwork(
    itemId: string,
    artworkType: string,
    maxWidth?: number,
    maxHeight?: number
  ): Promise<Buffer> {
    const params: Record<string, string> = {};
    if (maxWidth) params.maxWidth = String(maxWidth);
    if (maxHeight) params.maxHeight = String(maxHeight);

    const url = new URL(
      `/Items/${itemId}/Images/${artworkType}`,
      this.config.requireJellyfinConfig().url
    );
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw AppError.jellyfinError(
        `Failed to download ${artworkType} artwork: ${response.status} ${response.statusText}`,
        response.status,
        { itemId, artworkType }
      );
    }

    return Buffer.from(await response.arrayBuffer());
  }

  async deleteArtwork(itemId: string, artworkType: string): Promise<void> {
    await this.request(`/Items/${itemId}/Images/${artworkType}`, {
      method: 'DELETE',
    });
  }

  async applyItemArtwork(
    itemId: string,
    artworkType: string,
    artworkUrl: string
  ): Promise<void> {
    // Download the artwork from the URL
    const response = await fetch(artworkUrl);
    if (!response.ok) {
      throw AppError.jellyfinError(
        `Failed to download artwork from ${artworkUrl}: ${response.status} ${response.statusText}`,
        response.status,
        { itemId, artworkType, artworkUrl }
      );
    }

    const imageData = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Upload to Jellyfin
    await this.uploadArtwork(itemId, artworkType, imageData, contentType);
  }

  async uploadItemArtwork(
    itemId: string,
    artworkType: string,
    imageData: Buffer,
    contentType: string
  ): Promise<void> {
    // This is an alias for uploadArtwork to match the interface expected by the controller
    await this.uploadArtwork(itemId, artworkType, imageData, contentType);
  }

  // Collection operations
  async createCollection(
    name: string,
    itemIds: string[]
  ): Promise<{ Id: string }> {
    const response = await this.request<{ Id: string }>('/Collections', {
      method: 'POST',
      body: {
        Name: name,
        Ids: itemIds,
      },
    });

    return response.data;
  }

  async addItemsToCollection(
    collectionId: string,
    itemIds: string[]
  ): Promise<void> {
    await this.request(`/Collections/${collectionId}/Items`, {
      method: 'POST',
      params: {
        Ids: itemIds.join(','),
      },
    });
  }

  async removeItemsFromCollection(
    collectionId: string,
    itemIds: string[]
  ): Promise<void> {
    await this.request(`/Collections/${collectionId}/Items`, {
      method: 'DELETE',
      params: {
        Ids: itemIds.join(','),
      },
    });
  }

  async deleteCollection(collectionId: string): Promise<void> {
    await this.request(`/Items/${collectionId}`, {
      method: 'DELETE',
    });
  }

  async getCollections(userId?: string): Promise<JellyfinItem[]> {
    const endpoint = userId ? `/Users/${userId}/Items` : '/Items';
    const response = await this.request<{ Items: JellyfinItem[] }>(endpoint, {
      params: {
        IncludeItemTypes: 'BoxSet',
        Recursive: true,
        Fields: 'ProviderIds,Overview',
      },
    });

    return response.data.Items;
  }

  async refreshMetadata(
    itemId: string,
    options: {
      metadataRefreshMode?:
        | 'None'
        | 'ValidationOnly'
        | 'Default'
        | 'FullRefresh';
      imageRefreshMode?: 'None' | 'ValidationOnly' | 'Default' | 'FullRefresh';
      replaceAllMetadata?: boolean;
      replaceAllImages?: boolean;
    } = {}
  ): Promise<void> {
    await this.request(`/Items/${itemId}/Refresh`, {
      method: 'POST',
      body: {
        MetadataRefreshMode: options.metadataRefreshMode || 'Default',
        ImageRefreshMode: options.imageRefreshMode || 'Default',
        ReplaceAllMetadata: options.replaceAllMetadata || false,
        ReplaceAllImages: options.replaceAllImages || false,
      },
    });
  }

  async checkHealth(): Promise<{ status: 'up' | 'down'; info?: unknown }> {
    try {
      const systemInfo = await this.getSystemInfo();
      return {
        status: 'up',
        info: {
          version: systemInfo.Version,
          serverName: systemInfo.ServerName,
          operatingSystem: systemInfo.OperatingSystem,
        },
      };
    } catch (error) {
      return {
        status: 'down',
        info: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // Capability checks for version-specific features
  async hasCapability(capability: string): Promise<boolean> {
    try {
      const systemInfo = await this.getSystemInfo();
      const version = systemInfo.Version;

      // Add capability checks based on version
      switch (capability) {
        case 'collections':
          return this.versionGreaterThan(version, '10.8.0');
        case 'trickplay':
          return this.versionGreaterThan(version, '10.9.0');
        case 'metafin-plugin':
          return await this.checkMetafinPluginAvailable();
        default:
          return true;
      }
    } catch {
      return false;
    }
  }

  /**
   * Check if the Metafin plugin is installed and available
   */
  async checkMetafinPluginAvailable(): Promise<boolean> {
    try {
      const response = await this.request<{ Status: string }>('/metafin/status');
      return response.status === 200 && response.data?.Status === 'Active';
    } catch (error) {
      this.logger.debug(
        'Metafin plugin not available',
        error instanceof Error ? error.message : String(error),
        'JellyfinService'
      );
      return false;
    }
  }

  private versionGreaterThan(current: string, required: string): boolean {
    const currentParts = current.split('.').map(Number);
    const requiredParts = required.split('.').map(Number);

    for (
      let i = 0;
      i < Math.max(currentParts.length, requiredParts.length);
      i++
    ) {
      const currentPart = currentParts[i] || 0;
      const requiredPart = requiredParts[i] || 0;

      if (currentPart > requiredPart) return true;
      if (currentPart < requiredPart) return false;
    }

    return false;
  }
}
