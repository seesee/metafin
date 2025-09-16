export interface ProviderCapabilities {
  search: boolean;
  metadata: boolean;
  artwork: boolean;
  episodes: boolean;
  multiLanguage: boolean;
}

export interface ProviderSearchResult {
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
  backdropUrl?: string;
}

export interface ProviderEpisode {
  seasonNumber: number;
  episodeNumber: number;
  name?: string;
  overview?: string;
  airDate?: string;
  runtime?: number;
  stillUrl?: string;
}

export interface ProviderSeries {
  id: string;
  name: string;
  originalName?: string;
  overview?: string;
  year?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
  network?: string;
  country?: string;
  language?: string;
  genres?: string[];
  runtime?: number;
  rating?: number;
  posterUrl?: string;
  backdropUrl?: string;
  episodes?: ProviderEpisode[];
}

export interface ProviderArtwork {
  type: string;
  url: string;
  width?: number;
  height?: number;
  language?: string;
  rating?: number;
}

export enum ProviderType {
  TVMaze = 'tvmaze',
  Wikidata = 'wikidata',
  TMDb = 'tmdb',
}

export interface ProviderConfig {
  type: ProviderType;
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  rateLimit: number;
  timeout: number;
}

export interface ProviderError {
  provider: ProviderType;
  code: string;
  message: string;
  retryable: boolean;
  retryAfter?: number;
}
