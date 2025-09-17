<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient, ApiError } from '$lib/api/client.js';
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
  import LibraryGrid from '$lib/components/LibraryGrid.svelte';
  import SearchBar from '$lib/components/SearchBar.svelte';

  interface LibraryItem {
    id: string;
    jellyfinId: string;
    name: string;
    type: 'Series' | 'Season' | 'Episode' | 'Movie';
    year?: number;
    overview?: string;
    parentName?: string;
    library: {
      name: string;
    };
    hasArtwork: boolean;
    lastSyncAt: string;
  }

  let items: LibraryItem[] = [];
  let loading = true;
  let error: string | null = null;
  let searchQuery = '';
  let selectedType = 'all';
  let selectedLibrary = 'all';
  let libraries: string[] = [];

  // Pagination - now handled by API
  let currentPage = 1;
  let itemsPerPage = 24;
  let totalPages = 1;
  let totalItems = 0;

  onMount(async () => {
    await loadLibraryItems();
  });

  async function loadLibraryItems() {
    loading = true;
    error = null;

    try {
      const params: { [key: string]: string | number } = {
        page: currentPage,
        limit: itemsPerPage,
      };

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      if (selectedType !== 'all') {
        params.type = selectedType;
      }

      if (selectedLibrary !== 'all') {
        params.library = selectedLibrary;
      }

      const response = await apiClient.get<{
        items: LibraryItem[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }>(`library/items?${new URLSearchParams(params as Record<string, string>)}`);

      items = response.items;
      currentPage = response.pagination.page;
      totalPages = response.pagination.totalPages;
      totalItems = response.pagination.total;

      // Load libraries if not already loaded
      if (libraries.length === 0) {
        await loadLibraries();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        error = `${err.code}: ${err.message}`;
      } else {
        error = 'Failed to load library items';
      }
    } finally {
      loading = false;
    }
  }

  async function loadLibraries() {
    try {
      const librariesResponse = await apiClient.get<Array<{
        id: string;
        name: string;
        type: string;
        itemCount: number;
        lastSyncAt: string;
      }>>('library/libraries');

      libraries = librariesResponse.map((lib) => lib.name);
    } catch (err) {
      console.error('Failed to load libraries:', err);
    }
  }

  function handleSearch(event: CustomEvent<string>) {
    searchQuery = event.detail;
    currentPage = 1;
    loadLibraryItems();
  }

  function handleTypeChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    selectedType = target.value;
    currentPage = 1;
    loadLibraryItems();
  }

  function handleLibraryChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    selectedLibrary = target.value;
    currentPage = 1;
    loadLibraryItems();
  }

  function goToPage(page: number) {
    currentPage = Math.max(1, Math.min(page, totalPages));
    loadLibraryItems();
  }
</script>

<svelte:head>
  <title>Library - metafin</title>
</svelte:head>

<div class="container mx-auto px-6 py-8 max-w-7xl">
  <div class="flex items-center justify-between mb-8">
    <div>
      <h1 class="text-3xl font-bold">Media Library</h1>
      <p class="text-muted-foreground mt-2">
        Browse and manage your Jellyfin media collection
      </p>
    </div>

    <div class="flex gap-3">
      <button
        type="button"
        class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        on:click={loadLibraryItems}
        disabled={loading}
      >
        {loading ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  </div>

  <!-- Search and Filters -->
  <div class="mb-6 space-y-4">
    <SearchBar
      placeholder="Search by title or description..."
      on:search={handleSearch}
    />

    <div class="flex gap-4 flex-wrap">
      <!-- Type Filter -->
      <div class="flex items-center gap-2">
        <label for="type-filter" class="text-sm font-medium">Type:</label>
        <select
          id="type-filter"
          class="px-3 py-2 border border-border rounded-lg bg-background"
          value={selectedType}
          on:change={handleTypeChange}
        >
          <option value="all">All Types</option>
          <option value="Series">TV Series</option>
          <option value="Movie">Movies</option>
          <option value="Season">Seasons</option>
          <option value="Episode">Episodes</option>
        </select>
      </div>

      <!-- Library Filter -->
      <div class="flex items-center gap-2">
        <label for="library-filter" class="text-sm font-medium">Library:</label>
        <select
          id="library-filter"
          class="px-3 py-2 border border-border rounded-lg bg-background"
          value={selectedLibrary}
          on:change={handleLibraryChange}
        >
          <option value="all">All Libraries</option>
          {#each libraries as library}
            <option value={library}>{library}</option>
          {/each}
        </select>
      </div>

      <!-- Results Count -->
      <div class="flex items-center text-sm text-muted-foreground ml-auto">
        Showing {items.length} of {totalItems} items
        {#if currentPage > 1}
          (page {currentPage} of {totalPages})
        {/if}
      </div>
    </div>
  </div>

  <!-- Content -->
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <LoadingSpinner />
    </div>
  {:else if error}
    <div class="text-center py-12">
      <div class="text-destructive mb-4">
        <h3 class="text-lg font-semibold">Failed to Load Library</h3>
        <p>{error}</p>
      </div>
      <button
        type="button"
        class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        on:click={loadLibraryItems}
      >
        Try Again
      </button>
    </div>
  {:else if items.length === 0}
    <div class="text-center py-12 text-muted-foreground">
      {#if searchQuery || selectedType !== 'all' || selectedLibrary !== 'all'}
        <h3 class="text-lg font-semibold mb-2">No items match your filters</h3>
        <p class="mb-4">Try adjusting your search criteria or filters.</p>
        <button
          type="button"
          class="px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
          on:click={() => {
            searchQuery = '';
            selectedType = 'all';
            selectedLibrary = 'all';
            currentPage = 1;
            loadLibraryItems();
          }}
        >
          Clear Filters
        </button>
      {:else}
        <h3 class="text-lg font-semibold mb-2">No library items found</h3>
        <p>
          Your library appears to be empty. Try running a sync with Jellyfin.
        </p>
      {/if}
    </div>
  {:else}
    <LibraryGrid items={items} />

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="flex items-center justify-center gap-2 mt-8">
        <button
          type="button"
          class="px-3 py-2 border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
          disabled={currentPage === 1}
          on:click={() => goToPage(currentPage - 1)}
        >
          Previous
        </button>

        <!-- Page numbers -->
        {#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const startPage = Math.max(1, currentPage - 2);
          return startPage + i;
        }).filter((page) => page <= totalPages) as page}
          <button
            type="button"
            class="px-3 py-2 border rounded-lg transition-colors {page ===
            currentPage
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border hover:bg-accent'}"
            on:click={() => goToPage(page)}
          >
            {page}
          </button>
        {/each}

        <button
          type="button"
          class="px-3 py-2 border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
          disabled={currentPage === totalPages}
          on:click={() => goToPage(currentPage + 1)}
        >
          Next
        </button>
      </div>
    {/if}
  {/if}
</div>
