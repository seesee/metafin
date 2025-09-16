import { dev } from '$app/environment';
import { base } from '$app/paths';
import type { ApiResponse, ApiError as SharedApiError } from '@metafin/shared';

export class ApiClient {
  private baseUrl: string;

  constructor() {
    // In development, use the proxy. In production, use the base path
    this.baseUrl = dev ? '' : base;
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

    const data: ApiResponse<T> = await response.json();
    return data.data;
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
