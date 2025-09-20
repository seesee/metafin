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

  export let selectedItemIds: string[];
  export let items: LibraryItem[];
  export let isOpen: boolean = false;

  const dispatch = createEventDispatcher<{
    close: void;
    success: { message: string };
  }>();

  // Get selected items
  $: selectedItems = items.filter(item => selectedItemIds.includes(item.id));

  // Form data for bulk editing - only fields that make sense for bulk operations
  let formData = {
    // Only update fields that are checked
    updateGenres: false,
    genres: [] as string[],
    updateTags: false,
    tags: [] as string[],
    updateStudios: false,
    studios: [] as string[],
    updateOfficialRating: false,
    officialRating: '',
    updateType: false,
    type: '' as 'Series' | 'Season' | 'Episode' | 'Movie' | '',
  };

  let saving = false;
  let error: string | null = null;

  // Input helpers for array fields
  let genresInput = '';
  let tagsInput = '';
  let studiosInput = '';

  function addGenre() {
    const genre = genresInput.trim();
    if (genre && !formData.genres.includes(genre)) {
      formData.genres = [...formData.genres, genre];
      genresInput = '';
    }
  }

  function removeGenre(index: number) {
    formData.genres = formData.genres.filter((_, i) => i !== index);
  }

  function addTag() {
    const tag = tagsInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      formData.tags = [...formData.tags, tag];
      tagsInput = '';
    }
  }

  function removeTag(index: number) {
    formData.tags = formData.tags.filter((_, i) => i !== index);
  }

  function addStudio() {
    const studio = studiosInput.trim();
    if (studio && !formData.studios.includes(studio)) {
      formData.studios = [...formData.studios, studio];
      studiosInput = '';
    }
  }

  function removeStudio(index: number) {
    formData.studios = formData.studios.filter((_, i) => i !== index);
  }

  function handleKeyDown(event: KeyboardEvent, handler: () => void) {
    if (event.key === 'Enter') {
      event.preventDefault();
      handler();
    }
  }

  async function handleSave() {
    if (!selectedItemIds.length) return;

    saving = true;
    error = null;

    try {
      // Build the update payload with only checked fields
      const updateData: any = {};

      if (formData.updateGenres) {
        updateData.genres = formData.genres;
      }
      if (formData.updateTags) {
        updateData.tags = formData.tags;
      }
      if (formData.updateStudios) {
        updateData.studios = formData.studios;
      }
      if (formData.updateOfficialRating) {
        updateData.officialRating = formData.officialRating || null;
      }
      if (formData.updateType) {
        updateData.type = formData.type;
      }

      // Only proceed if at least one field is being updated
      const hasUpdates = Object.keys(updateData).length > 0;
      if (!hasUpdates) {
        error = 'Please select at least one field to update';
        return;
      }

      // Update each selected item
      const updatePromises = selectedItemIds.map(itemId =>
        apiClient.put(`library/items/${itemId}/metadata`, updateData)
      );

      await Promise.all(updatePromises);

      dispatch('success', {
        message: `Successfully updated ${selectedItemIds.length} item${selectedItemIds.length === 1 ? '' : 's'}`
      });
      handleClose();
    } catch (err) {
      if (err instanceof ApiError) {
        error = `Failed to update items: ${err.message}`;
      } else {
        error = 'Failed to update items';
      }
    } finally {
      saving = false;
    }
  }

  function handleClose() {
    // Reset form
    formData = {
      updateGenres: false,
      genres: [],
      updateTags: false,
      tags: [],
      updateStudios: false,
      studios: [],
      updateOfficialRating: false,
      officialRating: '',
      updateType: false,
      type: '',
    };
    genresInput = '';
    tagsInput = '';
    studiosInput = '';
    error = null;

    dispatch('close');
  }

  function handleModalClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }
</script>

{#if isOpen}
  <!-- Modal Backdrop -->
  <div
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
    on:click={handleModalClick}
    role="dialog"
    aria-modal="true"
    aria-labelledby="bulk-edit-title"
  >
    <!-- Modal Content -->
    <div class="bg-background border border-border rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-border">
        <div>
          <h2 id="bulk-edit-title" class="text-xl font-semibold">Bulk Edit Metadata</h2>
          <p class="text-sm text-muted-foreground mt-1">
            Editing {selectedItemIds.length} selected item{selectedItemIds.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          class="p-2 hover:bg-accent rounded-lg transition-colors"
          on:click={handleClose}
          aria-label="Close modal"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-6">
        {#if error}
          <div class="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            {error}
          </div>
        {/if}

        <!-- Selected Items Preview -->
        <div class="bg-muted/50 rounded-lg p-4">
          <h3 class="font-medium mb-2">Selected Items:</h3>
          <div class="space-y-1 max-h-32 overflow-y-auto">
            {#each selectedItems as item}
              <div class="text-sm flex items-center gap-2">
                <span class="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">{item.type}</span>
                <span>{item.name}</span>
                {#if item.parentName}
                  <span class="text-muted-foreground">({item.parentName})</span>
                {/if}
              </div>
            {/each}
          </div>
        </div>

        <!-- Warning -->
        <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div class="flex items-start gap-2">
            <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.262 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div class="text-sm">
              <p class="font-medium text-yellow-800 dark:text-yellow-200">Bulk Edit Warning</p>
              <p class="text-yellow-700 dark:text-yellow-300 mt-1">
                Only checked fields will be updated. Unchecked fields will remain unchanged for all selected items.
              </p>
            </div>
          </div>
        </div>

        <!-- Form Fields -->
        <div class="space-y-6">
          <!-- Genres -->
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="update-genres"
                bind:checked={formData.updateGenres}
                class="rounded border-border"
              />
              <label for="update-genres" class="font-medium">Update Genres</label>
            </div>
            {#if formData.updateGenres}
              <div class="ml-6 space-y-2">
                <div class="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add genre..."
                    bind:value={genresInput}
                    on:keydown={(e) => handleKeyDown(e, addGenre)}
                    class="flex-1 px-3 py-2 border border-border rounded-lg bg-background"
                  />
                  <button
                    type="button"
                    on:click={addGenre}
                    class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Add
                  </button>
                </div>
                {#if formData.genres.length > 0}
                  <div class="flex flex-wrap gap-2">
                    {#each formData.genres as genre, index}
                      <span class="flex items-center gap-1 px-2 py-1 bg-accent rounded text-sm">
                        {genre}
                        <button
                          type="button"
                          on:click={() => removeGenre(index)}
                          class="hover:text-destructive"
                          aria-label="Remove {genre}"
                        >
                          ×
                        </button>
                      </span>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Tags -->
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="update-tags"
                bind:checked={formData.updateTags}
                class="rounded border-border"
              />
              <label for="update-tags" class="font-medium">Update Tags</label>
            </div>
            {#if formData.updateTags}
              <div class="ml-6 space-y-2">
                <div class="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add tag..."
                    bind:value={tagsInput}
                    on:keydown={(e) => handleKeyDown(e, addTag)}
                    class="flex-1 px-3 py-2 border border-border rounded-lg bg-background"
                  />
                  <button
                    type="button"
                    on:click={addTag}
                    class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Add
                  </button>
                </div>
                {#if formData.tags.length > 0}
                  <div class="flex flex-wrap gap-2">
                    {#each formData.tags as tag, index}
                      <span class="flex items-center gap-1 px-2 py-1 bg-accent rounded text-sm">
                        {tag}
                        <button
                          type="button"
                          on:click={() => removeTag(index)}
                          class="hover:text-destructive"
                          aria-label="Remove {tag}"
                        >
                          ×
                        </button>
                      </span>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Studios -->
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="update-studios"
                bind:checked={formData.updateStudios}
                class="rounded border-border"
              />
              <label for="update-studios" class="font-medium">Update Studios</label>
            </div>
            {#if formData.updateStudios}
              <div class="ml-6 space-y-2">
                <div class="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add studio..."
                    bind:value={studiosInput}
                    on:keydown={(e) => handleKeyDown(e, addStudio)}
                    class="flex-1 px-3 py-2 border border-border rounded-lg bg-background"
                  />
                  <button
                    type="button"
                    on:click={addStudio}
                    class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Add
                  </button>
                </div>
                {#if formData.studios.length > 0}
                  <div class="flex flex-wrap gap-2">
                    {#each formData.studios as studio, index}
                      <span class="flex items-center gap-1 px-2 py-1 bg-accent rounded text-sm">
                        {studio}
                        <button
                          type="button"
                          on:click={() => removeStudio(index)}
                          class="hover:text-destructive"
                          aria-label="Remove {studio}"
                        >
                          ×
                        </button>
                      </span>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Official Rating -->
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="update-rating"
                bind:checked={formData.updateOfficialRating}
                class="rounded border-border"
              />
              <label for="update-rating" class="font-medium">Update Official Rating</label>
            </div>
            {#if formData.updateOfficialRating}
              <div class="ml-6">
                <input
                  type="text"
                  placeholder="e.g., PG-13, TV-MA, R"
                  bind:value={formData.officialRating}
                  class="w-full px-3 py-2 border border-border rounded-lg bg-background"
                />
              </div>
            {/if}
          </div>

          <!-- Type Conversion -->
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="update-type"
                bind:checked={formData.updateType}
                class="rounded border-border"
              />
              <label for="update-type" class="font-medium">Convert Type</label>
            </div>
            {#if formData.updateType}
              <div class="ml-6">
                <select
                  bind:value={formData.type}
                  class="w-full px-3 py-2 border border-border rounded-lg bg-background"
                >
                  <option value="">Select new type...</option>
                  <option value="Movie">Movie</option>
                  <option value="Series">TV Series</option>
                  <option value="Season">Season</option>
                  <option value="Episode">Episode</option>
                </select>
                <p class="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  ⚠️ Use with caution: Type conversion can affect metadata relationships
                </p>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 p-6 border-t border-border">
        <button
          type="button"
          class="px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
          on:click={handleClose}
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
            Saving...
          {:else}
            Save Changes
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}