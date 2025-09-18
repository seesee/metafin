<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient, ApiError } from '$lib/api/client.js';
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
  import SearchBar from '$lib/components/SearchBar.svelte';
  import StatusIndicator from '$lib/components/StatusIndicator.svelte';
  import ErrorDisplay from '$lib/components/ErrorDisplay.svelte';

  interface Collection {
    id: string;
    name: string;
    overview?: string;
    itemCount: number;
    createdAt: string;
    updatedAt: string;
  }

  interface CollectionsResponse {
    collections: Collection[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }

  let collections: Collection[] = [];
  let loading = true;
  let error: string | null = null;
  let searchQuery = '';
  let currentPage = 1;
  let totalPages = 1;
  let showCreateModal = false;
  let newCollectionName = '';
  let newCollectionOverview = '';
  let creating = false;

  onMount(async () => {
    await loadCollections();
  });

  async function loadCollections(page = 1, search = '') {
    loading = true;
    error = null;

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '24',
      });

      if (search.trim()) {
        params.set('search', search.trim());
      }

      const response = await apiClient.get<CollectionsResponse>(
        `collections?${params}`
      );

      collections = response.collections;
      currentPage = response.pagination.page;
      totalPages = response.pagination.totalPages;
    } catch (err) {
      if (err instanceof ApiError) {
        error = `${err.code}: ${err.message}`;
      } else {
        error = 'Failed to load collections';
      }
      console.error('Failed to load collections:', err);
    } finally {
      loading = false;
    }
  }

  function handleSearch(event: CustomEvent<string>) {
    searchQuery = event.detail;
    currentPage = 1;
    loadCollections(currentPage, searchQuery);
  }

  async function handlePageChange(page: number) {
    currentPage = page;
    await loadCollections(currentPage, searchQuery);
  }

  async function createCollection() {
    if (!newCollectionName.trim()) return;

    creating = true;
    try {
      await apiClient.post('collections', {
        name: newCollectionName.trim(),
        overview: newCollectionOverview.trim() || undefined,
        itemIds: [], // Empty collection
      });

      // Reset form and close modal
      newCollectionName = '';
      newCollectionOverview = '';
      showCreateModal = false;

      // Reload collections
      await loadCollections(currentPage, searchQuery);
    } catch (err) {
      console.error('Failed to create collection:', err);
      // Handle error appropriately
    } finally {
      creating = false;
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function getCollectionStatus(collection: Collection): 'success' | 'warning' | 'error' {
    if (collection.itemCount === 0) return 'error';
    if (collection.itemCount < 5) return 'warning';
    return 'success';
  }

  function getCollectionLabel(collection: Collection): string {
    if (collection.itemCount === 0) return 'Empty Collection';
    if (collection.itemCount === 1) return '1 Item';
    return `${collection.itemCount} Items`;
  }

  function getLastUpdateStatus(collection: Collection): 'success' | 'warning' | 'error' {
    const updateDate = new Date(collection.updatedAt);
    const daysSinceUpdate = Math.floor((Date.now() - updateDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceUpdate < 7) return 'success';
    if (daysSinceUpdate < 30) return 'warning';
    return 'error';
  }

  function getLastUpdateDetail(collection: Collection): string {
    const updateDate = new Date(collection.updatedAt);
    const daysSinceUpdate = Math.floor((Date.now() - updateDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceUpdate === 0) return 'Today';
    if (daysSinceUpdate === 1) return '1 day ago';
    if (daysSinceUpdate < 7) return `${daysSinceUpdate} days ago`;
    if (daysSinceUpdate < 30) return `${Math.floor(daysSinceUpdate / 7)} weeks ago`;
    return `${Math.floor(daysSinceUpdate / 30)} months ago`;
  }
</script>

<svelte:head>
  <title>Collections - metafin</title>
</svelte:head>

<div class="container mx-auto px-6 py-8 max-w-7xl">
  <div class="flex items-center justify-between mb-8">
    <div>
      <h1 class="text-3xl font-bold">Collections</h1>
      <p class="text-muted-foreground mt-2">
        Organize your media into custom collections
      </p>
    </div>

    <button
      type="button"
      class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
      on:click={() => (showCreateModal = true)}
    >
      Create Collection
    </button>
  </div>

  <!-- Search Bar -->
  <div class="mb-6 max-w-md">
    <SearchBar placeholder="Search collections..." on:search={handleSearch} />
  </div>

  <!-- Collections Grid -->
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <LoadingSpinner size="lg" text="Loading collections..." />
    </div>
  {:else if error}
    <ErrorDisplay
      {error}
      title="Failed to Load Collections"
      context="Collections Page"
      variant="error"
      showDetails={true}
      onRetry={() => loadCollections(currentPage, searchQuery)}
      persistent={false}
    />
  {:else if collections.length === 0}
    <div class="text-center py-12">
      <div class="text-muted-foreground mb-4">
        <svg
          class="w-16 h-16 mx-auto mb-4 opacity-50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <h3 class="text-lg font-medium mb-2">No collections found</h3>
        <p>
          {searchQuery
            ? `No collections match "${searchQuery}"`
            : 'Start by creating your first collection'}
        </p>
      </div>
      {#if !searchQuery}
        <button
          type="button"
          class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          on:click={() => (showCreateModal = true)}
        >
          Create Your First Collection
        </button>
      {/if}
    </div>
  {:else}
    <div
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    >
      {#each collections as collection}
        <a
          href="/collections/{collection.id}"
          class="block border border-border rounded-lg p-6 bg-card hover:shadow-lg transition-all duration-200 hover:border-primary/50 relative"
        >
          <!-- Collection Status Indicator -->
          <div class="absolute top-4 right-4">
            <StatusIndicator
              type="collection"
              status={getCollectionStatus(collection)}
              size="sm"
              showLabel={false}
            />
          </div>

          <div class="pr-8">
            <h3 class="font-semibold text-lg line-clamp-2 mb-3">
              {collection.name}
            </h3>

            {#if collection.overview}
              <p class="text-muted-foreground text-sm line-clamp-3 mb-4">
                {collection.overview}
              </p>
            {/if}

            <!-- Enhanced Status Information -->
            <div class="space-y-2">
              <StatusIndicator
                type="collection"
                status={getCollectionStatus(collection)}
                label={getCollectionLabel(collection)}
                count={collection.itemCount}
                size="sm"
                showLabel={true}
              />

              <div class="flex items-center justify-between">
                <div class="text-xs text-muted-foreground">
                  Created {formatDate(collection.createdAt)}
                </div>
                {#if collection.updatedAt !== collection.createdAt}
                  <StatusIndicator
                    type="metadata"
                    status={getLastUpdateStatus(collection)}
                    label="Last Updated"
                    detail={getLastUpdateDetail(collection)}
                    size="sm"
                    showDetail={true}
                  />
                {/if}
              </div>
            </div>
          </div>
        </a>
      {/each}
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="flex items-center justify-center gap-2 mt-8">
        <button
          type="button"
          class="px-3 py-2 text-sm border border-border rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={currentPage === 1}
          on:click={() => handlePageChange(currentPage - 1)}
        >
          Previous
        </button>

        {#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const startPage = Math.max(1, currentPage - 2);
          return startPage + i;
        }).filter((page) => page <= totalPages) as page}
          <button
            type="button"
            class="px-3 py-2 text-sm border border-border rounded-lg hover:bg-accent {currentPage ===
            page
              ? 'bg-primary text-primary-foreground'
              : ''}"
            on:click={() => handlePageChange(page)}
          >
            {page}
          </button>
        {/each}

        <button
          type="button"
          class="px-3 py-2 text-sm border border-border rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={currentPage === totalPages}
          on:click={() => handlePageChange(currentPage + 1)}
        >
          Next
        </button>
      </div>
    {/if}
  {/if}
</div>

<!-- Create Collection Modal -->
{#if showCreateModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div
      class="bg-background border border-border rounded-lg p-6 w-full max-w-md mx-4"
    >
      <h2 class="text-xl font-semibold mb-4">Create New Collection</h2>

      <form on:submit|preventDefault={createCollection} class="space-y-4">
        <div>
          <label for="collection-name" class="block text-sm font-medium mb-2">
            Collection Name
          </label>
          <input
            id="collection-name"
            type="text"
            bind:value={newCollectionName}
            placeholder="Enter collection name..."
            class="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            required
            disabled={creating}
          />
        </div>

        <div>
          <label
            for="collection-overview"
            class="block text-sm font-medium mb-2"
          >
            Description (optional)
          </label>
          <textarea
            id="collection-overview"
            bind:value={newCollectionOverview}
            placeholder="Enter collection description..."
            rows="3"
            class="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            disabled={creating}
          ></textarea>
        </div>

        <div class="flex gap-3 pt-2">
          <button
            type="button"
            class="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
            on:click={() => (showCreateModal = false)}
            disabled={creating}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            disabled={creating || !newCollectionName.trim()}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
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
