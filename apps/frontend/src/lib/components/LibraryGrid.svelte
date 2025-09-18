<script lang="ts">
  import { goto } from '$app/navigation';
  import AddToCollectionModal from './AddToCollectionModal.svelte';
  import StatusIndicator from './StatusIndicator.svelte';

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

  export let items: LibraryItem[];

  let showAddToCollectionModal = false;
  let selectedItem: LibraryItem | null = null;
  let successMessage = '';

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

  function getTypeColor(type: string): string {
    switch (type) {
      case 'Series':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Season':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Episode':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'Movie':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  }

  function handleItemClick(item: LibraryItem) {
    goto(`/library/item/${item.id}`);
  }

  function handleKeyDown(event: KeyboardEvent, item: LibraryItem) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleItemClick(item);
    }
  }

  function openAddToCollectionModal(item: LibraryItem, event: Event) {
    event.stopPropagation();
    selectedItem = item;
    showAddToCollectionModal = true;
  }

  function handleAddToCollectionSuccess(event: CustomEvent<{ collectionName: string }>) {
    successMessage = `Added "${selectedItem?.name}" to "${event.detail.collectionName}"`;
    setTimeout(() => {
      successMessage = '';
    }, 5000);
  }

  function closeAddToCollectionModal() {
    showAddToCollectionModal = false;
    selectedItem = null;
  }

  function getArtworkStatus(item: LibraryItem): 'success' | 'error' {
    return item.hasArtwork ? 'success' : 'error';
  }

  function getSyncStatus(item: LibraryItem): 'success' | 'warning' | 'error' {
    const syncDate = new Date(item.lastSyncAt);
    const now = new Date();
    const daysSinceSync = Math.floor((now.getTime() - syncDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceSync < 1) return 'success';
    if (daysSinceSync < 7) return 'warning';
    return 'error';
  }

  function getSyncDetail(item: LibraryItem): string {
    const syncDate = new Date(item.lastSyncAt);
    const daysSinceSync = Math.floor((Date.now() - syncDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceSync === 0) return 'Today';
    if (daysSinceSync === 1) return '1 day ago';
    if (daysSinceSync < 7) return `${daysSinceSync} days ago`;
    return `${daysSinceSync} days ago`;
  }
</script>

<!-- Success Message -->
{#if successMessage}
  <div class="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
    {successMessage}
  </div>
{/if}

<div
  class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4"
>
  {#each items as item (item.id)}
    <div
      class="group bg-card border border-border rounded-lg p-4 hover:shadow-md transition-all duration-200 cursor-pointer focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2"
      tabindex="0"
      role="button"
      on:click={() => handleItemClick(item)}
      on:keydown={(e) => handleKeyDown(e, item)}
      aria-label="View {item.name} details"
    >
      <!-- Placeholder for artwork with enhanced status -->
      <div
        class="aspect-[2/3] mb-3 bg-muted rounded-lg flex items-center justify-center relative overflow-hidden"
      >
        {#if item.hasArtwork}
          <!-- TODO: Add actual artwork display -->
          <div class="text-4xl opacity-50">🎨</div>
        {:else}
          <div class="text-4xl opacity-30">{getTypeIcon(item.type)}</div>
        {/if}

        <!-- Enhanced Status Indicators -->
        <div class="absolute top-2 right-2 flex flex-col gap-1">
          <StatusIndicator
            type="artwork"
            status={getArtworkStatus(item)}
            size="sm"
            showLabel={false}
          />
          <StatusIndicator
            type="sync"
            status={getSyncStatus(item)}
            size="sm"
            showLabel={false}
          />
        </div>
      </div>

      <!-- Item Info -->
      <div class="space-y-2">
        <div class="flex items-start justify-between gap-2">
          <h3
            class="font-medium text-sm group-hover:text-primary transition-colors leading-tight line-clamp-2"
          >
            {item.name}
          </h3>
          <button
            type="button"
            class="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded"
            on:click={(e) => openAddToCollectionModal(item, e)}
            title="Add to collection"
            aria-label="Add {item.name} to collection"
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
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </button>
        </div>

        <!-- Type and Year -->
        <div class="flex items-center gap-2 text-xs">
          <span class="px-2 py-1 rounded-full {getTypeColor(item.type)}">
            {item.type}
          </span>
          {#if item.year}
            <span class="text-muted-foreground">{item.year}</span>
          {/if}
        </div>

        <!-- Parent name for seasons/episodes -->
        {#if item.parentName}
          <div class="text-xs text-muted-foreground truncate">
            {item.parentName}
          </div>
        {/if}

        <!-- Library -->
        <div class="text-xs text-muted-foreground">
          📚 {item.library.name}
        </div>

        <!-- Overview -->
        {#if item.overview}
          <p class="text-xs text-muted-foreground line-clamp-2 leading-tight">
            {item.overview}
          </p>
        {/if}

        <!-- Enhanced Status Information -->
        <div class="flex items-center justify-between text-xs">
          <StatusIndicator
            type="sync"
            status={getSyncStatus(item)}
            label="Last Sync"
            detail={getSyncDetail(item)}
            size="sm"
            showLabel={true}
            showDetail={true}
          />
          <StatusIndicator
            type="artwork"
            status={getArtworkStatus(item)}
            label={item.hasArtwork ? 'Has Artwork' : 'No Artwork'}
            size="sm"
            showLabel={true}
          />
        </div>
      </div>
    </div>
  {/each}
</div>

<!-- Add to Collection Modal -->
{#if selectedItem}
  <AddToCollectionModal
    itemId={selectedItem.id}
    itemName={selectedItem.name}
    isOpen={showAddToCollectionModal}
    on:close={closeAddToCollectionModal}
    on:success={handleAddToCollectionSuccess}
  />
{/if}

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
