<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { apiClient, ApiError } from '$lib/api/client.js';
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

  interface CollectionItem {
    id: string;
    jellyfinId: string;
    name: string;
    type: string;
    year?: number;
    overview?: string;
    parentName?: string;
    libraryName?: string;
    hasArtwork: boolean;
    lastSyncAt: string;
  }

  interface Collection {
    id: string;
    name: string;
    overview?: string;
    createdAt: string;
    updatedAt: string;
    items: CollectionItem[];
  }

  let collection: Collection | null = null;
  let loading = true;
  let error: string | null = null;
  let editing = false;
  let editName = '';
  let editOverview = '';
  let saving = false;

  $: collectionId = $page.params.id;

  onMount(async () => {
    await loadCollection();
  });

  async function loadCollection() {
    loading = true;
    error = null;

    try {
      collection = await apiClient.get<Collection>(
        `collections/${collectionId}`
      );
      editName = collection.name;
      editOverview = collection.overview || '';
    } catch (err) {
      if (err instanceof ApiError) {
        error = `${err.code}: ${err.message}`;
      } else {
        error = 'Failed to load collection';
      }
      console.error('Failed to load collection:', err);
    } finally {
      loading = false;
    }
  }

  async function saveCollection() {
    if (!collection || !editName.trim()) return;

    saving = true;
    try {
      await apiClient.put(`collections/${collection.id}`, {
        name: editName.trim(),
        overview: editOverview.trim() || undefined,
      });

      // Update local state
      collection.name = editName.trim();
      collection.overview = editOverview.trim() || undefined;
      editing = false;
    } catch (err) {
      console.error('Failed to save collection:', err);
      // Handle error appropriately
    } finally {
      saving = false;
    }
  }

  async function removeItem(itemId: string) {
    if (!collection) return;

    try {
      await apiClient.put(`collections/${collection.id}`, {
        removeItemIds: [itemId],
      });

      // Remove item from local state
      collection.items = collection.items.filter((item) => item.id !== itemId);
    } catch (err) {
      console.error('Failed to remove item from collection:', err);
      // Handle error appropriately
    }
  }

  async function deleteCollection() {
    if (!collection) return;

    const confirmed = confirm(
      `Are you sure you want to delete "${collection.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await apiClient.delete(`collections/${collection.id}`);
      // Redirect to collections list
      window.location.href = '/collections';
    } catch (err) {
      console.error('Failed to delete collection:', err);
      // Handle error appropriately
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getTypeIcon(type: string): string {
    switch (type.toLowerCase()) {
      case 'series':
        return '📺';
      case 'season':
        return '📋';
      case 'episode':
        return '🎬';
      case 'movie':
        return '🎭';
      default:
        return '📄';
    }
  }
</script>

<svelte:head>
  <title>{collection?.name || 'Collection'} - metafin</title>
</svelte:head>

<div class="container mx-auto px-6 py-8 max-w-7xl">
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <LoadingSpinner size="lg" text="Loading collection..." />
    </div>
  {:else if error}
    <div
      class="text-destructive p-4 border border-destructive/20 rounded-lg bg-destructive/5 max-w-md"
    >
      <p class="font-medium">Failed to load collection</p>
      <p class="text-sm mt-1">{error}</p>
    </div>
  {:else if collection}
    <!-- Collection Header -->
    <div class="flex items-start justify-between mb-8">
      <div class="flex-1">
        <div class="flex items-center gap-4 mb-4">
          <a
            href="/collections"
            class="text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Collections
          </a>
        </div>

        {#if editing}
          <form
            on:submit|preventDefault={saveCollection}
            class="space-y-4 max-w-2xl"
          >
            <div>
              <label
                for="collection-name"
                class="block text-sm font-medium mb-2"
              >
                Collection Name
              </label>
              <input
                id="collection-name"
                type="text"
                bind:value={editName}
                class="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
                disabled={saving}
              />
            </div>

            <div>
              <label
                for="collection-overview"
                class="block text-sm font-medium mb-2"
              >
                Description
              </label>
              <textarea
                id="collection-overview"
                bind:value={editOverview}
                rows="3"
                class="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={saving}
              ></textarea>
            </div>

            <div class="flex gap-3">
              <button
                type="button"
                class="px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
                on:click={() => {
                  editing = false;
                  editName = collection.name;
                  editOverview = collection.overview || '';
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                disabled={saving || !editName.trim()}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        {:else}
          <h1 class="text-3xl font-bold mb-2">{collection.name}</h1>
          {#if collection.overview}
            <p class="text-muted-foreground text-lg mb-4">
              {collection.overview}
            </p>
          {/if}
          <div class="text-sm text-muted-foreground space-y-1">
            <div>{collection.items.length} items</div>
            <div>Created {formatDate(collection.createdAt)}</div>
            {#if collection.updatedAt !== collection.createdAt}
              <div>Updated {formatDate(collection.updatedAt)}</div>
            {/if}
          </div>
        {/if}
      </div>

      {#if !editing}
        <div class="flex gap-2">
          <button
            type="button"
            class="px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
            on:click={() => (editing = true)}
          >
            Edit
          </button>
          <button
            type="button"
            class="px-4 py-2 text-destructive border border-destructive/20 rounded-lg hover:bg-destructive/5 transition-colors"
            on:click={deleteCollection}
          >
            Delete
          </button>
        </div>
      {/if}
    </div>

    <!-- Collection Items -->
    {#if !editing}
      {#if collection.items.length === 0}
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
            <h3 class="text-lg font-medium mb-2">No items in collection</h3>
            <p>Add items to this collection from the library browser</p>
          </div>
        </div>
      {:else}
        <div class="space-y-4">
          <h2 class="text-xl font-semibold">
            Items ({collection.items.length})
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each collection.items as item}
              <div class="border border-border rounded-lg p-4 bg-card">
                <div class="flex items-start justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <span class="text-lg">{getTypeIcon(item.type)}</span>
                    <div>
                      <h3 class="font-medium line-clamp-1">
                        <a
                          href="/library/item/{item.id}"
                          class="hover:text-primary transition-colors"
                        >
                          {item.name}
                        </a>
                      </h3>
                      {#if item.parentName}
                        <p class="text-sm text-muted-foreground line-clamp-1">
                          {item.parentName}
                        </p>
                      {/if}
                    </div>
                  </div>

                  <button
                    type="button"
                    class="text-muted-foreground hover:text-destructive transition-colors p-1"
                    on:click={() => removeItem(item.id)}
                    title="Remove from collection"
                  >
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div class="text-xs text-muted-foreground space-y-1">
                  <div class="flex items-center gap-2">
                    <span class="capitalize">{item.type}</span>
                    {#if item.year}
                      <span>•</span>
                      <span>{item.year}</span>
                    {/if}
                  </div>
                  {#if item.libraryName}
                    <div>Library: {item.libraryName}</div>
                  {/if}
                  <div class="flex items-center gap-2">
                    <span
                      class="w-2 h-2 rounded-full {item.hasArtwork
                        ? 'bg-green-500'
                        : 'bg-yellow-500'}"
                    ></span>
                    <span>{item.hasArtwork ? 'Has artwork' : 'No artwork'}</span
                    >
                  </div>
                </div>

                {#if item.overview}
                  <p class="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {item.overview}
                  </p>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .line-clamp-1 {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
