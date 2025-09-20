<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { apiClient, ApiError } from '$lib/api/client.js';
  import LoadingSpinner from './LoadingSpinner.svelte';

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

  export let item: LibraryItem;

  const dispatch = createEventDispatcher<{
    save: LibraryItem;
    cancel: void;
  }>();

  let formData = {
    name: item.name,
    overview: item.overview || '',
    year: item.year || undefined,
    type: item.type,
    genres: [...(item.genres || [])],
    tags: [...(item.tags || [])],
    studios: [...(item.studios || [])],
    premiereDate: item.premiereDate || '',
    endDate: item.endDate || '',
  };

  let saving = false;
  let error: string | null = null;

  // Form field management
  let newGenre = '';
  let newTag = '';
  let newStudio = '';

  async function handleSave() {
    saving = true;
    error = null;

    try {
      const updatedItem = await apiClient.put<LibraryItem>(`library/items/${item.id}`, {
        name: formData.name,
        overview: formData.overview || undefined,
        year: formData.year || undefined,
        type: formData.type,
        genres: formData.genres,
        tags: formData.tags,
        studios: formData.studios,
        premiereDate: formData.premiereDate || undefined,
        endDate: formData.endDate || undefined,
      });

      dispatch('save', updatedItem);
    } catch (err) {
      if (err instanceof ApiError) {
        error = `${err.code}: ${err.message}`;
      } else {
        error = 'Failed to save metadata changes';
      }
    } finally {
      saving = false;
    }
  }

  function handleCancel() {
    dispatch('cancel');
  }

  function addGenre() {
    if (newGenre.trim() && !formData.genres.includes(newGenre.trim())) {
      formData.genres = [...formData.genres, newGenre.trim()];
      newGenre = '';
    }
  }

  function removeGenre(genre: string) {
    formData.genres = formData.genres.filter((g) => g !== genre);
  }

  function addTag() {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      formData.tags = [...formData.tags, newTag.trim()];
      newTag = '';
    }
  }

  function removeTag(tag: string) {
    formData.tags = formData.tags.filter((t) => t !== tag);
  }

  function addStudio() {
    if (newStudio.trim() && !formData.studios.includes(newStudio.trim())) {
      formData.studios = [...formData.studios, newStudio.trim()];
      newStudio = '';
    }
  }

  function removeStudio(studio: string) {
    formData.studios = formData.studios.filter((s) => s !== studio);
  }

  function handleGenreKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addGenre();
    }
  }

  function handleTagKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTag();
    }
  }

  function handleStudioKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addStudio();
    }
  }
</script>

<div class="bg-card border border-border rounded-lg p-6">
  <div class="flex items-center justify-between mb-6">
    <h3 class="text-lg font-semibold">Edit Metadata</h3>
    <div class="flex gap-2">
      <button
        type="button"
        class="px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
        on:click={handleCancel}
        disabled={saving}
      >
        Cancel
      </button>
      <button
        type="button"
        class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        on:click={handleSave}
        disabled={saving}
      >
        {#if saving}
          <LoadingSpinner size="sm" />
        {:else}
          Save Changes
        {/if}
      </button>
    </div>
  </div>

  {#if error}
    <div
      class="mb-6 p-4 bg-destructive/5 border border-destructive/20 rounded-lg text-destructive"
    >
      <p class="font-medium">Failed to save changes</p>
      <p class="text-sm mt-1">{error}</p>
    </div>
  {/if}

  <form class="space-y-6" on:submit|preventDefault={handleSave}>
    <!-- Basic Information -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div>
        <label for="name" class="block text-sm font-medium mb-2">Title</label>
        <input
          id="name"
          type="text"
          bind:value={formData.name}
          class="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          required
        />
      </div>

      <div>
        <label for="type" class="block text-sm font-medium mb-2">Type</label>
        <select
          id="type"
          bind:value={formData.type}
          class="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          required
        >
          <option value="Movie">Movie</option>
          <option value="Series">TV Series</option>
          <option value="Season">Season</option>
          <option value="Episode">Episode</option>
        </select>
      </div>

      <div>
        <label for="year" class="block text-sm font-medium mb-2">Year</label>
        <input
          id="year"
          type="number"
          bind:value={formData.year}
          min="1800"
          max="2100"
          class="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>
    </div>

    <!-- Overview -->
    <div>
      <label for="overview" class="block text-sm font-medium mb-2"
        >Overview</label
      >
      <textarea
        id="overview"
        bind:value={formData.overview}
        rows="4"
        class="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-vertical"
        placeholder="Enter a description of the content..."
      ></textarea>
    </div>

    <!-- Dates -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label for="premiereDate" class="block text-sm font-medium mb-2"
          >Premiere Date</label
        >
        <input
          id="premiereDate"
          type="date"
          bind:value={formData.premiereDate}
          class="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      <div>
        <label for="endDate" class="block text-sm font-medium mb-2"
          >End Date</label
        >
        <input
          id="endDate"
          type="date"
          bind:value={formData.endDate}
          class="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>
    </div>

    <!-- Genres -->
    <div>
      <label for="new-genre" class="block text-sm font-medium mb-2"
        >Genres</label
      >
      <div class="space-y-3">
        <div class="flex flex-wrap gap-2">
          {#each formData.genres as genre}
            <span
              class="inline-flex items-center gap-1 px-2 py-1 bg-accent rounded-full text-sm"
            >
              {genre}
              <button
                type="button"
                class="hover:text-destructive transition-colors"
                on:click={() => removeGenre(genre)}
                aria-label="Remove {genre}"
              >
                ×
              </button>
            </span>
          {/each}
        </div>
        <div class="flex gap-2">
          <input
            id="new-genre"
            type="text"
            bind:value={newGenre}
            placeholder="Add a genre..."
            class="flex-1 px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            on:keydown={handleGenreKeydown}
          />
          <button
            type="button"
            class="px-4 py-2 bg-accent hover:bg-accent/80 rounded-lg transition-colors"
            on:click={addGenre}
            disabled={!newGenre.trim()}
          >
            Add
          </button>
        </div>
      </div>
    </div>

    <!-- Tags -->
    <div>
      <label for="new-tag" class="block text-sm font-medium mb-2">Tags</label>
      <div class="space-y-3">
        <div class="flex flex-wrap gap-2">
          {#each formData.tags as tag}
            <span
              class="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-full text-sm"
            >
              {tag}
              <button
                type="button"
                class="hover:text-destructive transition-colors"
                on:click={() => removeTag(tag)}
                aria-label="Remove {tag}"
              >
                ×
              </button>
            </span>
          {/each}
        </div>
        <div class="flex gap-2">
          <input
            id="new-tag"
            type="text"
            bind:value={newTag}
            placeholder="Add a tag..."
            class="flex-1 px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            on:keydown={handleTagKeydown}
          />
          <button
            type="button"
            class="px-4 py-2 bg-accent hover:bg-accent/80 rounded-lg transition-colors"
            on:click={addTag}
            disabled={!newTag.trim()}
          >
            Add
          </button>
        </div>
      </div>
    </div>

    <!-- Studios -->
    <div>
      <label for="new-studio" class="block text-sm font-medium mb-2"
        >Studios</label
      >
      <div class="space-y-3">
        <div class="flex flex-wrap gap-2">
          {#each formData.studios as studio}
            <span
              class="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-full text-sm"
            >
              {studio}
              <button
                type="button"
                class="hover:text-destructive transition-colors"
                on:click={() => removeStudio(studio)}
                aria-label="Remove {studio}"
              >
                ×
              </button>
            </span>
          {/each}
        </div>
        <div class="flex gap-2">
          <input
            id="new-studio"
            type="text"
            bind:value={newStudio}
            placeholder="Add a studio..."
            class="flex-1 px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            on:keydown={handleStudioKeydown}
          />
          <button
            type="button"
            class="px-4 py-2 bg-accent hover:bg-accent/80 rounded-lg transition-colors"
            on:click={addStudio}
            disabled={!newStudio.trim()}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  </form>
</div>
