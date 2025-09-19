import { dev } from '$app/environment';
import { base } from '$app/paths';
import type { ApiError as SharedApiError } from '@metafin/shared';

export class ApiClient {
  private baseUrl: string;

  constructor() {
    // In development, use Vite proxy (no hostname needed)
    // In production, use the base path with full URL
    if (dev) {
      this.baseUrl = '';
    } else {
      this.baseUrl = base;
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api/${endpoint.replace(/^\//, '')}`;

    // Generate request ID for correlation
    const requestId = crypto.randomUUID();

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorData: SharedApiError;
      try {
        errorData = await response.json();
      } catch {
        errorData = {
          code: 'NETWORK_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
          requestId,
          timestamp: new Date().toISOString(),
        };
      }
      throw new ApiError(errorData);
    }

    const data: T = await response.json();
    return data;
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : null,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : null,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : null,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: 'DELETE' });
  }

  // Health check endpoint
  async getHealth(): Promise<{
    metafin: { status: string; info: unknown };
    database: { status: string; info: unknown };
    jellyfin?: { status: string; info?: unknown };
  }> {
    return this.get('health');
  }

  // Hello endpoint for testing
  async getHello(): Promise<{ message: string; timestamp: string }> {
    return this.get('hello');
  }

  // Provider endpoints
  async getProviderHealth(): Promise<
    Array<{
      provider: string;
      name: string;
      healthy: boolean;
      message?: string;
    }>
  > {
    return this.get('providers/health');
  }

  async getProviderConfigs(): Promise<
    Array<{
      type: string;
      enabled: boolean;
      rateLimit: number;
      timeout: number;
    }>
  > {
    return this.get('providers/configs');
  }

  async searchProviders(request: {
    query: string;
    year?: number;
    language?: string;
    includeAdult?: boolean;
  }): Promise<
    Array<{
      provider: string;
      results: Array<{
        id: string;
        name: string;
        year?: number;
        overview?: string;
        confidence: number;
        language?: string;
        country?: string;
        network?: string;
        status?: string;
        genres?: string[];
        posterUrl?: string;
      }>;
      error?: string;
    }>
  > {
    return this.post('providers/search', request);
  }

  // Library endpoints
  async getLibraryItems(params?: {
    page?: number;
    limit?: number;
    type?: string;
    library?: string;
    search?: string;
  }): Promise<{
    items: Array<{
      id: string;
      jellyfinId: string;
      name: string;
      type: string;
      year?: number;
      overview?: string;
      parentName?: string;
      libraryName: string;
      hasArtwork: boolean;
      lastSyncAt: string;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          query.set(key, String(value));
        }
      });
    }

    const endpoint = query.toString()
      ? `library/items?${query}`
      : 'library/items';
    return this.get(endpoint);
  }

  // Review Queue endpoints
  async getReviewQueue(params?: {
    status?: 'pending' | 'reviewed' | 'dismissed';
    priority?: 'low' | 'medium' | 'high';
    library?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'score' | 'addedAt' | 'priority';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    items: Array<{
      id: string;
      jellyfinId: string;
      name: string;
      type: string;
      library: { name: string };
      path?: string;
      misclassificationScore?: number;
      misclassificationReasons?: string;
      priority: 'low' | 'medium' | 'high';
      addedAt: string;
      reviewedAt?: string;
      reviewedBy?: string;
      status: 'pending' | 'reviewed' | 'dismissed';
    }>;
    pagination: {
      limit: number;
      offset: number;
      total: number;
      hasMore: boolean;
    };
  }> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          query.set(key, String(value));
        }
      });
    }

    const endpoint = query.toString()
      ? `review-queue?${query}`
      : 'review-queue';
    return this.get(endpoint);
  }

  async getReviewQueueStats(libraryId?: string): Promise<{
    totalItems: number;
    pendingItems: number;
    highPriorityItems: number;
    mediumPriorityItems: number;
    lowPriorityItems: number;
    averageScore: number;
    oldestItemAge: number;
  }> {
    const query = libraryId ? `?library=${libraryId}` : '';
    return this.get(`review-queue/stats${query}`);
  }

  async reviewItem(
    itemId: string,
    action: {
      action:
        | 'dismiss'
        | 'correct_type'
        | 'update_metadata'
        | 'flag_for_manual';
      newType?: string;
      metadata?: Record<string, unknown>;
      notes?: string;
    },
    reviewedBy?: string
  ): Promise<{ success: boolean; message: string }> {
    return this.post(`review-queue/${itemId}/review`, {
      ...action,
      reviewedBy,
    });
  }

  async bulkReviewItems(
    itemIds: string[],
    action: {
      action:
        | 'dismiss'
        | 'correct_type'
        | 'update_metadata'
        | 'flag_for_manual';
      newType?: string;
      metadata?: Record<string, unknown>;
      notes?: string;
    },
    reviewedBy?: string
  ): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ itemId: string; error: string }>;
  }> {
    return this.post('review-queue/bulk-review', {
      itemIds,
      action,
      reviewedBy,
    });
  }

  async clearReviewQueue(libraryId?: string): Promise<{
    success: boolean;
    message: string;
    itemsCleared: number;
  }> {
    const query = libraryId ? `?library=${libraryId}` : '';
    return this.delete(`review-queue/clear${query}`);
  }

  async getItemHistory(itemId: string): Promise<
    Array<{
      timestamp: string;
      operation: string;
      details: unknown;
      success: boolean;
    }>
  > {
    return this.get(`review-queue/${itemId}/history`);
  }

  // Misclassification endpoints
  async getMisclassifiedItems(params?: {
    library?: string;
    severity?: 'low' | 'medium' | 'high';
    limit?: number;
    offset?: number;
  }): Promise<{
    items: Array<{
      id: string;
      jellyfinId: string;
      name: string;
      type: string;
      library: string;
      path?: string;
      misclassificationScore?: number;
      reasons: Array<{
        type: string;
        description: string;
        severity: 'low' | 'medium' | 'high';
        confidence: number;
      }>;
    }>;
    pagination: {
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          query.set(key, String(value));
        }
      });
    }

    const endpoint = query.toString()
      ? `misclassifications?${query}`
      : 'misclassifications';
    return this.get(endpoint);
  }

  async analyzeItem(itemId: string): Promise<{
    itemId: string;
    currentType: string;
    suggestedType?: string;
    score: number;
    reasons: Array<{
      type: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
      confidence: number;
    }>;
    needsReview: boolean;
  }> {
    return this.get(`misclassifications/${itemId}/analysis`);
  }

  async scanLibraryForMisclassifications(
    libraryId?: string,
    itemTypes?: string[]
  ): Promise<{
    totalItems: number;
    itemsScanned: number;
    misclassifiedItems: number;
    highConfidenceIssues: number;
    mediumConfidenceIssues: number;
    lowConfidenceIssues: number;
    duration: number;
  }> {
    const query = new URLSearchParams();
    if (libraryId) query.set('library', libraryId);
    if (itemTypes) query.set('types', itemTypes.join(','));

    const endpoint = query.toString()
      ? `misclassifications/scan?${query}`
      : 'misclassifications/scan';
    return this.post(endpoint);
  }

  async dismissMisclassification(itemId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.delete(`misclassifications/${itemId}`);
  }

  // Configuration endpoints
  async getConfiguration(): Promise<{
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
  }> {
    return this.get('configuration');
  }

  async updateConfiguration(config: {
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
  }): Promise<{
    success: boolean;
    message: string;
    updated: string[];
    requiresRestart: boolean;
  }> {
    return this.put('configuration', config);
  }

  async testConnection(service: 'jellyfin' | 'tmdb', config: unknown): Promise<{
    success: boolean;
    message: string;
    details?: unknown;
  }> {
    return this.post('configuration/test-connection', { service, config });
  }

  async reloadConfiguration(): Promise<{
    success: boolean;
    message: string;
    reloaded: string[];
  }> {
    return this.post('configuration/reload');
  }

  // Library sync endpoints
  async startLibrarySync(options?: {
    fullSync?: boolean;
    libraryIds?: string[];
  }): Promise<{
    message: string;
    progress?: {
      totalItems: number;
      processedItems: number;
      failedItems: number;
      currentLibrary?: string;
      stage: 'initializing' | 'syncing_libraries' | 'syncing_items' | 'analyzing_misclassifications' | 'completed' | 'failed';
      startTime: string;
      estimatedEndTime?: string;
    };
  }> {
    return this.post('library/sync', options);
  }

  async getLibrarySyncStatus(): Promise<{
    progress: {
      totalItems: number;
      processedItems: number;
      failedItems: number;
      currentLibrary?: string;
      stage: 'initializing' | 'syncing_libraries' | 'syncing_items' | 'analyzing_misclassifications' | 'completed' | 'failed';
      startTime: string;
      estimatedEndTime?: string;
    } | null;
  }> {
    return this.get('library/sync/status');
  }

  async cancelLibrarySync(): Promise<{
    message: string;
  }> {
    return this.post('library/sync/cancel');
  }
}

export class ApiError extends Error {
  constructor(public data: SharedApiError) {
    super(data.message);
    this.name = 'ApiError';
  }

  get code(): string {
    return this.data.code;
  }

  get requestId(): string {
    return this.data.requestId;
  }

  get timestamp(): string {
    return this.data.timestamp;
  }

  get details(): Record<string, unknown> | undefined {
    return this.data.details;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
