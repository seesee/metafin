<script lang="ts">
  import { onMount } from 'svelte';
  import { ApiError } from '$lib/api/client.js';
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
    libraryName: string;
    hasArtwork: boolean;
    lastSyncAt: string;
  }

  let items: LibraryItem[] = [];
  let filteredItems: LibraryItem[] = [];
  let loading = true;
  let error: string | null = null;
  let searchQuery = '';
  let selectedType = 'all';
  let selectedLibrary = 'all';
  let libraries: string[] = [];

  // Pagination
  let currentPage = 1;
  let itemsPerPage = 24;

  $: totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  $: paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  onMount(async () => {
    await loadLibraryItems();
  });

  async function loadLibraryItems() {
    loading = true;
    error = null;

    try {
      // TODO: Replace with actual API endpoint
      // const response = await apiClient.get<{ items: LibraryItem[], total: number }>('library/items');
      // items = response.items;
      // totalItems = response.total;

      // Mock data for now
      items = [
        {
          id: '1',
          jellyfinId: 'jf-1',
          name: 'Breaking Bad',
          type: 'Series',
          year: 2008,
          overview:
            'A high school chemistry teacher turned methamphetamine producer.',
          libraryName: 'TV Shows',
          hasArtwork: true,
          lastSyncAt: new Date().toISOString(),
        },
        {
          id: '2',
          jellyfinId: 'jf-2',
          name: 'The Wire',
          type: 'Series',
          year: 2002,
          overview: 'A crime drama focusing on the Baltimore drug scene.',
          libraryName: 'TV Shows',
          hasArtwork: false,
          lastSyncAt: new Date().toISOString(),
        },
        {
          id: '3',
          jellyfinId: 'jf-3',
          name: 'The Godfather',
          type: 'Movie',
          year: 1972,
          overview: 'The aging patriarch of an organized crime dynasty.',
          libraryName: 'Movies',
          hasArtwork: true,
          lastSyncAt: new Date().toISOString(),
        },
      ];

      // Extract unique libraries
      libraries = [...new Set(items.map((item) => item.libraryName))];

      filterItems();
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

  function filterItems() {
    filteredItems = items.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.overview &&
          item.overview.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = selectedType === 'all' || item.type === selectedType;
      const matchesLibrary =
        selectedLibrary === 'all' || item.libraryName === selectedLibrary;

      return matchesSearch && matchesType && matchesLibrary;
    });

    // Reset to first page when filters change
    currentPage = 1;
  }

  function handleSearch(query: string) {
    searchQuery = query;
    filterItems();
  }

  function handleTypeChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    selectedType = target.value;
    filterItems();
  }

  function handleLibraryChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    selectedLibrary = target.value;
    filterItems();
  }

  function goToPage(page: number) {
    currentPage = Math.max(1, Math.min(page, totalPages));
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
      on:search={(e) => handleSearch(e.detail)}
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
        Showing {paginatedItems.length} of {filteredItems.length} items
        {#if filteredItems.length !== items.length}
          (filtered from {items.length} total)
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
  {:else if filteredItems.length === 0}
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
            filterItems();
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
    <LibraryGrid items={paginatedItems} />

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
