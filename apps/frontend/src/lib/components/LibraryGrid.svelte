<script lang="ts">
  import { goto } from '$app/navigation';

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

  export let items: LibraryItem[];

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
</script>

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
      <!-- Placeholder for artwork -->
      <div
        class="aspect-[2/3] mb-3 bg-muted rounded-lg flex items-center justify-center relative overflow-hidden"
      >
        {#if item.hasArtwork}
          <!-- TODO: Add actual artwork display -->
          <div class="text-4xl opacity-50">🎨</div>
          <div
            class="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full"
            title="Has artwork"
          ></div>
        {:else}
          <div class="text-4xl opacity-30">{getTypeIcon(item.type)}</div>
          <div
            class="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"
            title="Missing artwork"
          ></div>
        {/if}
      </div>

      <!-- Item Info -->
      <div class="space-y-2">
        <div class="flex items-start justify-between gap-2">
          <h3
            class="font-medium text-sm group-hover:text-primary transition-colors leading-tight line-clamp-2"
          >
            {item.name}
          </h3>
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
          📚 {item.libraryName}
        </div>

        <!-- Overview -->
        {#if item.overview}
          <p class="text-xs text-muted-foreground line-clamp-2 leading-tight">
            {item.overview}
          </p>
        {/if}

        <!-- Last sync -->
        <div class="text-xs text-muted-foreground">
          Synced {new Date(item.lastSyncAt).toLocaleDateString('en-GB')}
        </div>
      </div>
    </div>
  {/each}
</div>

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
