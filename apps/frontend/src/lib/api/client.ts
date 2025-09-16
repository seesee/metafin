import { dev } from '$app/environment';
import { base } from '$app/paths';
import type { ApiError as SharedApiError } from '@metafin/shared';

export class ApiClient {
  private baseUrl: string;

  constructor() {
    // In development, connect directly to backend port. In production, use the base path
    this.baseUrl = dev ? 'http://localhost:8081' : base;
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
