<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { apiClient, ApiError } from '$lib/api/client.js';
  import LoadingSpinner from './LoadingSpinner.svelte';

  export let itemId: string;
  export let itemName: string;
  export let isOpen = false;

  const dispatch = createEventDispatcher<{
    close: void;
    success: { collectionName: string };
  }>();

  interface Collection {
    id: string;
    name: string;
    overview?: string;
    itemCount: number;
    createdAt: string;
    updatedAt: string;
  }

  let collections: Collection[] = [];
  let loading = false;
  let adding = false;
  let error: string | null = null;
  let selectedCollectionId = '';

  $: if (isOpen) {
    loadCollections();
  }

  async function loadCollections() {
    loading = true;
    error = null;

    try {
      const response = await apiClient.get<{
        collections: Collection[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }>('collections?limit=100');

      collections = response.collections;
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

  async function addToCollection() {
    if (!selectedCollectionId) return;

    adding = true;
    error = null;

    try {
      await apiClient.put(`collections/${selectedCollectionId}`, {
        addItemIds: [itemId],
      });

      const selectedCollection = collections.find(c => c.id === selectedCollectionId);
      dispatch('success', {
        collectionName: selectedCollection?.name || 'collection'
      });
      dispatch('close');
    } catch (err) {
      if (err instanceof ApiError) {
        error = `${err.code}: ${err.message}`;
      } else {
        error = 'Failed to add item to collection';
      }
      console.error('Failed to add item to collection:', err);
    } finally {
      adding = false;
    }
  }

  function handleClose() {
    selectedCollectionId = '';
    error = null;
    dispatch('close');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }
</script>

{#if isOpen}
  <!-- Modal backdrop -->
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    on:click={handleClose}
    on:keydown={handleKeydown}
    role="presentation"
  >
    <!-- Modal content -->
    <div
      class="bg-background border border-border rounded-lg p-6 w-full max-w-md mx-4"
      on:click|stopPropagation
      role="dialog"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <h2 id="modal-title" class="text-xl font-semibold mb-2">Add to Collection</h2>
      <p id="modal-description" class="text-muted-foreground mb-6">
        Add "{itemName}" to a collection
      </p>

      {#if error}
        <div
          class="mb-4 p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-destructive text-sm"
        >
          {error}
        </div>
      {/if}

      {#if loading}
        <div class="flex items-center justify-center py-8">
          <LoadingSpinner size="sm" text="Loading collections..." />
        </div>
      {:else if collections.length === 0}
        <div class="text-center py-8 text-muted-foreground">
          <p class="mb-4">No collections found.</p>
          <a
            href="/collections"
            class="text-primary hover:underline"
            on:click={handleClose}
          >
            Create your first collection
          </a>
        </div>
      {:else}
        <form on:submit|preventDefault={addToCollection} class="space-y-4">
          <div>
            <label for="collection-select" class="block text-sm font-medium mb-2">
              Select Collection
            </label>
            <select
              id="collection-select"
              bind:value={selectedCollectionId}
              class="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
              disabled={adding}
            >
              <option value="">Choose a collection...</option>
              {#each collections as collection}
                <option value={collection.id}>
                  {collection.name} ({collection.itemCount} items)
                </option>
              {/each}
            </select>
          </div>

          <div class="flex gap-3 pt-2">
            <button
              type="button"
              class="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
              on:click={handleClose}
              disabled={adding}
            >
              Cancel
            </button>
            <button
              type="submit"
              class="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              disabled={adding || !selectedCollectionId}
            >
              {adding ? 'Adding...' : 'Add to Collection'}
            </button>
          </div>
        </form>
      {/if}
    </div>
  </div>
{/if}

<svelte:window on:keydown={handleKeydown} />