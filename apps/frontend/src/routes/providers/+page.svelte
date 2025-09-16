<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient, ApiError } from '$lib/api/client.js';
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
  import SearchBar from '$lib/components/SearchBar.svelte';

  interface ProviderHealth {
    provider: string;
    name: string;
    healthy: boolean;
    message?: string;
  }

  interface SearchResults {
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
  }

  let providerHealth: ProviderHealth[] = [];
  let searchResults: SearchResults[] = [];
  let loading = true;
  let searching = false;
  let error: string | null = null;
  let searchQuery = '';

  onMount(async () => {
    await loadProviderHealth();
  });

  async function loadProviderHealth() {
    loading = true;
    error = null;

    try {
      providerHealth =
        await apiClient.get<ProviderHealth[]>('providers/health');
    } catch (err) {
      if (err instanceof ApiError) {
        error = `${err.code}: ${err.message}`;
      } else {
        error = 'Failed to load provider health';
      }
    } finally {
      loading = false;
    }
  }

  async function searchProviders(query: string) {
    if (!query.trim()) {
      searchResults = [];
      return;
    }

    searching = true;
    try {
      searchResults = await apiClient.post<SearchResults[]>(
        'providers/search',
        {
          query: query.trim(),
          language: 'en',
        }
      );
    } catch (err) {
      console.error('Search failed:', err);
      searchResults = [];
    } finally {
      searching = false;
    }
  }

  function getProviderIcon(provider: string): string {
    switch (provider) {
      case 'tvmaze':
        return '📺';
      case 'wikidata':
        return '🌐';
      case 'tmdb':
        return '🎬';
      default:
        return '🔍';
    }
  }

  function getProviderColor(provider: string): string {
    switch (provider) {
      case 'tvmaze':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'wikidata':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'tmdb':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  }

  function handleSearch(event: CustomEvent<string>) {
    searchQuery = event.detail;
    searchProviders(searchQuery);
  }
</script>

<svelte:head>
  <title>Providers - metafin</title>
</svelte:head>

<div class="container mx-auto px-6 py-8 max-w-7xl">
  <div class="flex items-center justify-between mb-8">
    <div>
      <h1 class="text-3xl font-bold">Metadata Providers</h1>
      <p class="text-muted-foreground mt-2">
        Search and match content using external metadata providers
      </p>
    </div>

    <button
      type="button"
      class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
      on:click={loadProviderHealth}
      disabled={loading}
    >
      {loading ? 'Refreshing...' : 'Refresh'}
    </button>
  </div>

  <!-- Provider Health Status -->
  <div class="mb-8">
    <h2 class="text-xl font-semibold mb-4">Provider Status</h2>

    {#if loading}
      <div class="flex items-center gap-3">
        <LoadingSpinner size="sm" text="Loading provider status..." />
      </div>
    {:else if error}
      <div
        class="text-destructive p-4 border border-destructive/20 rounded-lg bg-destructive/5"
      >
        <p class="font-medium">Failed to load provider status</p>
        <p class="text-sm mt-1">{error}</p>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each providerHealth as provider}
          <div class="border border-border rounded-lg p-4 bg-card">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-3">
                <span class="text-2xl"
                  >{getProviderIcon(provider.provider)}</span
                >
                <div>
                  <h3 class="font-semibold">{provider.name}</h3>
                  <span
                    class="text-xs px-2 py-1 rounded-full {getProviderColor(
                      provider.provider
                    )}"
                  >
                    {provider.provider}
                  </span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <div
                  class="w-3 h-3 rounded-full {provider.healthy
                    ? 'bg-green-500'
                    : 'bg-red-500'}"
                  title={provider.healthy ? 'Healthy' : 'Unhealthy'}
                ></div>
                <span class="text-sm text-muted-foreground">
                  {provider.healthy ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

            {#if provider.message}
              <p class="text-sm text-muted-foreground">{provider.message}</p>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Search Interface -->
  <div class="mb-8">
    <h2 class="text-xl font-semibold mb-4">Search Providers</h2>

    <div class="max-w-2xl">
      <SearchBar
        placeholder="Search for TV series or movies..."
        on:search={handleSearch}
      />
    </div>

    {#if searching}
      <div class="mt-4">
        <LoadingSpinner size="sm" text="Searching providers..." />
      </div>
    {/if}
  </div>

  <!-- Search Results -->
  {#if searchResults.length > 0}
    <div class="space-y-6">
      {#each searchResults as providerResult}
        <div class="border border-border rounded-lg p-6 bg-card">
          <div class="flex items-center gap-3 mb-4">
            <span class="text-2xl"
              >{getProviderIcon(providerResult.provider)}</span
            >
            <h3 class="text-lg font-semibold">
              {providerHealth.find(
                (p) => p.provider === providerResult.provider
              )?.name || providerResult.provider}
            </h3>
            <span
              class="text-xs px-2 py-1 rounded-full {getProviderColor(
                providerResult.provider
              )}"
            >
              {providerResult.results.length} results
            </span>
          </div>

          {#if providerResult.error}
            <div
              class="text-destructive text-sm bg-destructive/5 border border-destructive/20 rounded-lg p-3"
            >
              <p class="font-medium">Search failed</p>
              <p>{providerResult.error}</p>
            </div>
          {:else if providerResult.results.length === 0}
            <div class="text-muted-foreground text-sm text-center py-4">
              No results found for "{searchQuery}"
            </div>
          {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {#each providerResult.results as result}
                <div
                  class="border border-border rounded-lg p-4 hover:shadow-sm transition-shadow"
                >
                  <div class="flex items-start justify-between mb-2">
                    <h4 class="font-medium line-clamp-1">{result.name}</h4>
                    <div
                      class="text-xs bg-accent px-2 py-1 rounded flex-shrink-0 ml-2"
                    >
                      {Math.round(result.confidence * 100)}%
                    </div>
                  </div>

                  {#if result.year}
                    <div class="text-sm text-muted-foreground mb-2">
                      {result.year}
                    </div>
                  {/if}

                  {#if result.overview}
                    <p class="text-sm text-muted-foreground line-clamp-3 mb-3">
                      {result.overview}
                    </p>
                  {/if}

                  <div class="flex flex-wrap gap-1 mb-3">
                    {#if result.network}
                      <span class="text-xs bg-muted px-2 py-1 rounded">
                        📺 {result.network}
                      </span>
                    {/if}
                    {#if result.country}
                      <span class="text-xs bg-muted px-2 py-1 rounded">
                        🌍 {result.country}
                      </span>
                    {/if}
                    {#if result.language}
                      <span class="text-xs bg-muted px-2 py-1 rounded">
                        🗣️ {result.language}
                      </span>
                    {/if}
                  </div>

                  {#if result.genres && result.genres.length > 0}
                    <div class="flex flex-wrap gap-1 mb-3">
                      {#each result.genres.slice(0, 3) as genre}
                        <span class="text-xs bg-accent/50 px-2 py-1 rounded">
                          {genre}
                        </span>
                      {/each}
                    </div>
                  {/if}

                  <button
                    type="button"
                    class="w-full px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
                  >
                    View Details
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {:else if searchQuery && !searching}
    <div class="text-center py-8 text-muted-foreground">
      <p>Enter a search query to find metadata from external providers</p>
    </div>
  {/if}
</div>

<style>
  .line-clamp-1 {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
