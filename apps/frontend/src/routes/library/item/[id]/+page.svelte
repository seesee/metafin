<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { apiClient, ApiError } from '$lib/api/client.js';
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
  import MetadataEditor from '$lib/components/MetadataEditor.svelte';
  import ArtworkGallery from '$lib/components/ArtworkGallery.svelte';

  interface LibraryItem {
    id: string;
    jellyfinId: string;
    name: string;
    type: 'Series' | 'Season' | 'Episode' | 'Movie';
    year?: number;
    overview?: string;
    parentName?: string;
    libraryName: string;
    hasArtwork: boolean;
    lastSyncAt: string;
    genres?: string[];
    tags?: string[];
    studios?: string[];
    providerIds?: Record<string, string>;
    premiereDate?: string;
    endDate?: string;
    officialRating?: string;
    communityRating?: number;
    people?: Array<{ name: string; role?: string; type: string }>;
  }

  interface ProviderMatch {
    provider: string;
    id: string;
    name: string;
    confidence: number;
    metadata?: Record<string, unknown>;
  }

  let item: LibraryItem | null = null;
  let loading = true;
  let error: string | null = null;
  let editing = false;
  let providerMatches: ProviderMatch[] = [];
  let loadingMatches = false;

  $: itemId = $page.params.id;

  onMount(async () => {
    if (itemId) {
      await loadItem();
    }
  });

  async function loadItem() {
    loading = true;
    error = null;

    try {
      // TODO: Replace with actual API call
      // item = await apiClient.get<LibraryItem>(`library/items/${itemId}`);

      // Mock data for now
      item = {
        id: itemId,
        jellyfinId: `jf-${itemId}`,
        name: 'Breaking Bad',
        type: 'Series',
        year: 2008,
        overview:
          "A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine in order to secure his family's future.",
        libraryName: 'TV Shows',
        hasArtwork: true,
        lastSyncAt: new Date().toISOString(),
        genres: ['Crime', 'Drama', 'Thriller'],
        tags: ['Award Winner', 'Dark', 'Mature'],
        studios: ['Sony Pictures Television', 'High Bridge Entertainment'],
        providerIds: {
          tvdb: '81189',
          tmdb: '1396',
          imdb: 'tt0903747',
        },
        premiereDate: '2008-01-20',
        endDate: '2013-09-29',
        officialRating: 'TV-MA',
        communityRating: 9.5,
        people: [
          { name: 'Bryan Cranston', role: 'Walter White', type: 'Actor' },
          { name: 'Aaron Paul', role: 'Jesse Pinkman', type: 'Actor' },
          { name: 'Vince Gilligan', type: 'Creator' },
        ],
      };
    } catch (err) {
      if (err instanceof ApiError) {
        error = `${err.code}: ${err.message}`;
      } else {
        error = 'Failed to load item';
      }
    } finally {
      loading = false;
    }
  }

  async function searchProviderMatches() {
    if (!item) return;

    loadingMatches = true;
    try {
      const searchResults = await apiClient.post<
        { provider: string; results: ProviderMatch[] }[]
      >('providers/search', {
        query: item.name,
        year: item.year,
        language: 'en',
      });

      providerMatches = searchResults
        .flatMap((result) =>
          result.results.map(
            (match): ProviderMatch => ({
              provider: result.provider,
              id: match.id,
              name: match.name,
              confidence: match.confidence,
              metadata: match.metadata,
            })
          )
        )
        .sort((a, b) => b.confidence - a.confidence);
    } catch (err) {
      console.error('Failed to search provider matches:', err);
    } finally {
      loadingMatches = false;
    }
  }

  function handleMetadataUpdate(updatedItem: LibraryItem) {
    item = updatedItem;
    editing = false;
  }

  function handleEditCancel() {
    editing = false;
  }

  function getTypeIcon(type: string): string {
    switch (type) {
      case 'Series':
        return '📺';
      case 'Season':
        return '📅';
      case 'Episode':
        return '🎬';
      case 'Movie':
        return '🎭';
      default:
        return '📄';
    }
  }

  function formatDate(dateString?: string): string {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-GB');
  }

  function formatRating(rating?: number): string {
    if (!rating) return 'Not rated';
    return `${rating}/10`;
  }
</script>

<svelte:head>
  <title>{item?.name || 'Loading...'} - metafin</title>
</svelte:head>

<div class="container mx-auto px-6 py-8 max-w-6xl">
  <!-- Header -->
  <div class="flex items-center gap-4 mb-6">
    <button
      type="button"
      class="p-2 rounded-lg hover:bg-accent transition-colors"
      on:click={() => goto('/library')}
      aria-label="Back to library"
    >
      <svg
        class="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 19l-7-7 7-7"
        />
      </svg>
    </button>
    <h1 class="text-2xl font-bold">Library Item Details</h1>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <LoadingSpinner size="lg" text="Loading item details..." />
    </div>
  {:else if error}
    <div class="text-center py-12">
      <div class="text-destructive mb-4">
        <h3 class="text-lg font-semibold">Failed to Load Item</h3>
        <p>{error}</p>
      </div>
      <button
        type="button"
        class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        on:click={loadItem}
      >
        Try Again
      </button>
    </div>
  {:else if item}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Main Content -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Item Header -->
        <div class="bg-card border border-border rounded-lg p-6">
          <div class="flex items-start gap-4">
            <div class="text-4xl">{getTypeIcon(item.type)}</div>
            <div class="flex-1">
              <div class="flex items-start justify-between mb-2">
                <h2 class="text-2xl font-bold">{item.name}</h2>
                <div class="flex gap-2">
                  {#if !editing}
                    <button
                      type="button"
                      class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                      on:click={() => (editing = true)}
                    >
                      Edit Metadata
                    </button>
                  {/if}
                </div>
              </div>

              <div
                class="flex items-center gap-4 text-sm text-muted-foreground mb-3"
              >
                <span class="px-2 py-1 bg-accent rounded-full">{item.type}</span
                >
                {#if item.year}
                  <span>{item.year}</span>
                {/if}
                {#if item.officialRating}
                  <span class="px-2 py-1 bg-muted rounded"
                    >{item.officialRating}</span
                  >
                {/if}
                {#if item.communityRating}
                  <span>⭐ {formatRating(item.communityRating)}</span>
                {/if}
              </div>

              {#if item.parentName}
                <p class="text-muted-foreground mb-3">
                  Part of: <strong>{item.parentName}</strong>
                </p>
              {/if}

              {#if item.overview}
                <p class="text-sm leading-relaxed mb-4">{item.overview}</p>
              {/if}

              <!-- Metadata Grid -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {#if item.genres && item.genres.length > 0}
                  <div>
                    <h4 class="font-medium mb-1">Genres</h4>
                    <div class="flex flex-wrap gap-1">
                      {#each item.genres as genre}
                        <span class="px-2 py-1 bg-accent/50 rounded text-xs"
                          >{genre}</span
                        >
                      {/each}
                    </div>
                  </div>
                {/if}

                {#if item.studios && item.studios.length > 0}
                  <div>
                    <h4 class="font-medium mb-1">Studios</h4>
                    <p class="text-muted-foreground">
                      {item.studios.join(', ')}
                    </p>
                  </div>
                {/if}

                {#if item.premiereDate}
                  <div>
                    <h4 class="font-medium mb-1">Premiere Date</h4>
                    <p class="text-muted-foreground">
                      {formatDate(item.premiereDate)}
                    </p>
                  </div>
                {/if}

                {#if item.endDate}
                  <div>
                    <h4 class="font-medium mb-1">End Date</h4>
                    <p class="text-muted-foreground">
                      {formatDate(item.endDate)}
                    </p>
                  </div>
                {/if}

                <div>
                  <h4 class="font-medium mb-1">Library</h4>
                  <p class="text-muted-foreground">{item.libraryName}</p>
                </div>

                <div>
                  <h4 class="font-medium mb-1">Last Sync</h4>
                  <p class="text-muted-foreground">
                    {formatDate(item.lastSyncAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- People -->
        {#if item.people && item.people.length > 0}
          <div class="bg-card border border-border rounded-lg p-6">
            <h3 class="text-lg font-semibold mb-4">Cast & Crew</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {#each item.people as person}
                <div class="p-3 bg-muted rounded-lg">
                  <div class="font-medium text-sm">{person.name}</div>
                  {#if person.role}
                    <div class="text-xs text-muted-foreground">
                      as {person.role}
                    </div>
                  {/if}
                  <div class="text-xs text-muted-foreground">{person.type}</div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Provider IDs -->
        {#if item.providerIds && Object.keys(item.providerIds).length > 0}
          <div class="bg-card border border-border rounded-lg p-6">
            <h3 class="text-lg font-semibold mb-4">Provider IDs</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              {#each Object.entries(item.providerIds) as [provider, id]}
                <div class="p-3 bg-muted rounded-lg text-center">
                  <div class="font-medium text-sm uppercase">{provider}</div>
                  <div class="text-xs text-muted-foreground font-mono">
                    {id}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Metadata Editor -->
        {#if editing}
          <MetadataEditor
            {item}
            on:save={({ detail }) => handleMetadataUpdate(detail)}
            on:cancel={handleEditCancel}
          />
        {/if}
      </div>

      <!-- Sidebar -->
      <div class="space-y-6">
        <!-- Artwork -->
        <ArtworkGallery itemId={item.id} hasArtwork={item.hasArtwork} />

        <!-- Provider Matches -->
        <div class="bg-card border border-border rounded-lg p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold">Provider Matches</h3>
            <button
              type="button"
              class="text-sm px-3 py-2 bg-accent hover:bg-accent/80 rounded-lg transition-colors"
              on:click={searchProviderMatches}
              disabled={loadingMatches}
            >
              {loadingMatches ? 'Searching...' : 'Find Matches'}
            </button>
          </div>

          {#if loadingMatches}
            <LoadingSpinner size="sm" text="Searching providers..." />
          {:else if providerMatches.length > 0}
            <div class="space-y-3">
              {#each providerMatches.slice(0, 5) as match}
                <div
                  class="p-3 border border-border rounded-lg hover:bg-accent/20 transition-colors"
                >
                  <div class="flex items-center justify-between mb-1">
                    <span class="font-medium text-sm">{match.name}</span>
                    <span class="text-xs bg-accent px-2 py-1 rounded">
                      {Math.round(match.confidence * 100)}%
                    </span>
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {match.provider} • ID: {match.id}
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-sm text-muted-foreground text-center py-4">
              No provider matches found. Click "Find Matches" to search.
            </p>
          {/if}
        </div>

        <!-- Tags -->
        {#if item.tags && item.tags.length > 0}
          <div class="bg-card border border-border rounded-lg p-6">
            <h3 class="text-lg font-semibold mb-4">Tags</h3>
            <div class="flex flex-wrap gap-2">
              {#each item.tags as tag}
                <span class="px-2 py-1 bg-muted rounded text-xs">{tag}</span>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
