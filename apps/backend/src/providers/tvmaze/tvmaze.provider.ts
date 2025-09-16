import { BaseProvider } from '../base-provider.js';
import {
  ProviderType,
  type ProviderCapabilities,
  type ProviderSearchResult,
  type ProviderSeries,
  type ProviderArtwork,
  type ProviderConfig,
  type ProviderEpisode,
} from '@metafin/shared';
import type {
  SearchOptions,
  MetadataOptions,
  ArtworkOptions,
} from '../base-provider.js';

interface TVMazeShow {
  id: number;
  url: string;
  name: string;
  type: string;
  language: string;
  genres: string[];
  status: string;
  runtime?: number;
  averageRuntime?: number;
  premiered?: string;
  ended?: string;
  officialSite?: string;
  schedule: {
    time: string;
    days: string[];
  };
  rating: {
    average?: number;
  };
  weight: number;
  network?: {
    id: number;
    name: string;
    country: {
      name: string;
      code: string;
      timezone: string;
    };
    officialSite?: string;
  };
  webChannel?: {
    id: number;
    name: string;
    country?: {
      name: string;
      code: string;
      timezone: string;
    };
    officialSite?: string;
  };
  dvdCountry?: {
    name: string;
    code: string;
    timezone: string;
  };
  externals: {
    tvdb?: number;
    imdb?: string;
    thetvdb?: number;
  };
  image?: {
    medium: string;
    original: string;
  };
  summary?: string;
  updated: number;
}

interface TVMazeEpisode {
  id: number;
  url: string;
  name?: string;
  season: number;
  number?: number;
  type: string;
  airdate?: string;
  airtime?: string;
  airstamp?: string;
  runtime?: number;
  rating: {
    average?: number;
  };
  image?: {
    medium: string;
    original: string;
  };
  summary?: string;
}

interface TVMazeSearchResult {
  score: number;
  show: TVMazeShow;
}

export class TVMazeProvider extends BaseProvider {
  private readonly baseUrl = 'https://api.tvmaze.com';

  constructor(config: ProviderConfig) {
    super(config);
  }

  get type(): ProviderType {
    return ProviderType.TVMaze;
  }

  get capabilities(): ProviderCapabilities {
    return {
      search: true,
      metadata: true,
      artwork: true,
      episodes: true,
      multiLanguage: true,
    };
  }

  get name(): string {
    return 'TVMaze';
  }

  private async request<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<T> {
    await this.enforceRateLimit();

    const url = new URL(endpoint, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'metafin/0.1.0 (https://github.com/metafin/metafin)',
        },
      });
      clearTimeout(timeoutId);

      if (response.status === 429) {
        const retryAfter = parseInt(
          response.headers.get('retry-after') || '60'
        );
        throw this.createError(
          'RATE_LIMITED',
          'Rate limit exceeded',
          true,
          retryAfter
        );
      }

      if (response.status === 404) {
        throw this.createError('NOT_FOUND', 'Resource not found', false);
      }

      if (!response.ok) {
        throw this.createError(
          'HTTP_ERROR',
          `TVMaze API error: ${response.status} ${response.statusText}`,
          response.status >= 500
        );
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw this.createError(
          'INVALID_RESPONSE',
          'Expected JSON response',
          false
        );
      }

      return response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createError('TIMEOUT', 'Request timeout', true);
      }
      throw error;
    }
  }

  async search(options: SearchOptions): Promise<ProviderSearchResult[]> {
    try {
      const results = await this.request<TVMazeSearchResult[]>(
        '/search/shows',
        {
          q: options.query,
        }
      );

      return results.map((result) => this.mapShowToSearchResult(result));
    } catch (error) {
      if (error instanceof Error && error.message.includes('NOT_FOUND')) {
        return [];
      }
      throw error;
    }
  }

  async getMetadata(
    id: string,
    options?: MetadataOptions
  ): Promise<ProviderSeries> {
    const show = await this.request<TVMazeShow>(`/shows/${id}`);
    const episodes = options?.includeEpisodes
      ? await this.getEpisodes(id)
      : undefined;

    return this.mapShowToSeries(show, episodes);
  }

  async getArtwork(
    id: string,
    _options?: ArtworkOptions
  ): Promise<ProviderArtwork[]> {
    const show = await this.request<TVMazeShow>(`/shows/${id}`);
    const artwork: ProviderArtwork[] = [];

    if (show.image) {
      artwork.push({
        type: 'poster',
        url: show.image.original,
        width: undefined,
        height: undefined,
        language: show.language === 'English' ? 'en' : undefined,
        rating: show.rating.average,
      });
    }

    return artwork;
  }

  private async getEpisodes(showId: string): Promise<ProviderEpisode[]> {
    try {
      const episodes = await this.request<TVMazeEpisode[]>(
        `/shows/${showId}/episodes`
      );
      return episodes.map((ep) => this.mapEpisode(ep));
    } catch (error) {
      if (error instanceof Error && error.message.includes('NOT_FOUND')) {
        return [];
      }
      throw error;
    }
  }

  private mapShowToSearchResult(
    result: TVMazeSearchResult
  ): ProviderSearchResult {
    const show = result.show;
    const year = show.premiered
      ? new Date(show.premiered).getFullYear()
      : undefined;

    return {
      id: String(show.id),
      name: show.name,
      year,
      overview: this.cleanSummary(show.summary),
      confidence: result.score,
      language: show.language,
      country: show.network?.country?.name || show.webChannel?.country?.name,
      network: show.network?.name || show.webChannel?.name,
      status: show.status,
      genres: show.genres,
      posterUrl: show.image?.original,
    };
  }

  private mapShowToSeries(
    show: TVMazeShow,
    episodes?: ProviderEpisode[]
  ): ProviderSeries {
    const year = show.premiered
      ? new Date(show.premiered).getFullYear()
      : undefined;

    return {
      id: String(show.id),
      name: show.name,
      originalName: show.name,
      overview: this.cleanSummary(show.summary),
      year,
      startDate: show.premiered,
      endDate: show.ended,
      status: show.status,
      network: show.network?.name || show.webChannel?.name,
      country: show.network?.country?.name || show.webChannel?.country?.name,
      language: show.language,
      genres: show.genres,
      runtime: show.runtime || show.averageRuntime,
      rating: show.rating.average,
      posterUrl: show.image?.original,
      episodes,
    };
  }

  private mapEpisode(episode: TVMazeEpisode): ProviderEpisode {
    return {
      seasonNumber: episode.season,
      episodeNumber: episode.number || 0,
      name: episode.name,
      overview: this.cleanSummary(episode.summary),
      airDate: episode.airdate,
      runtime: episode.runtime,
      stillUrl: episode.image?.original,
    };
  }

  private cleanSummary(summary?: string): string | undefined {
    if (!summary) return undefined;

    // Remove HTML tags
    return summary
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }
}
