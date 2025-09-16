export interface ApiResponse<T = unknown> {
  data: T;
  success: boolean;
  requestId: string;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  requestId: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface FilterOptions {
  search?: string;
  type?: string;
  libraryId?: string;
  missingProviderIds?: string[];
  hasArtwork?: boolean;
  year?: {
    min?: number;
    max?: number;
  };
  runtime?: {
    min?: number;
    max?: number;
  };
  dateAdded?: {
    from?: string;
    to?: string;
  };
  suspectedMisclassification?: boolean;
  genres?: string[];
  tags?: string[];
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

export interface RequestOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}
