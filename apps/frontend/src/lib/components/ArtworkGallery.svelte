<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { apiClient, ApiError } from '$lib/api/client.js';
  import LoadingSpinner from './LoadingSpinner.svelte';

  export let itemId: string;
  export let hasArtwork: boolean = false;

  const dispatch = createEventDispatcher<{
    artworkUpdated: { itemId: string; hasArtwork: boolean };
  }>();

  interface ArtworkCandidate {
    id: string;
    itemId: string;
    type: string;
    url: string;
    width?: number;
    height?: number;
    provider: string;
    confidence: number;
    isApplied: boolean;
    createdAt: string;
  }

  let artworkCandidates: ArtworkCandidate[] = [];
  let loading = false;
  let uploading = false;
  let searching = false;
  let error: string | null = null;
  let selectedFile: File | null = null;
  let fileInput: HTMLInputElement;

  // Mock artwork types for different content types
  const artworkTypes = [
    { value: 'Primary', label: 'Poster' },
    { value: 'Backdrop', label: 'Backdrop' },
    { value: 'Thumb', label: 'Thumbnail' },
    { value: 'Logo', label: 'Logo' },
    { value: 'Banner', label: 'Banner' },
  ];

  onMount(() => {
    loadExistingArtworkCandidates();
  });

  async function loadExistingArtworkCandidates() {
    loading = true;
    error = null;

    try {
      artworkCandidates = await apiClient.get<ArtworkCandidate[]>(
        `library/items/${itemId}/artwork`
      );
    } catch (err) {
      if (err instanceof ApiError) {
        error = `${err.code}: ${err.message}`;
      } else {
        error = 'Failed to load artwork candidates';
      }
    } finally {
      loading = false;
    }
  }

  async function searchArtworkCandidates() {
    searching = true;
    error = null;

    try {
      const searchResult = await apiClient.post(
        `library/items/${itemId}/artwork/search`,
        {
          language: 'en',
        }
      );

      // Reload the artwork candidates to get the updated list including new search results
      await loadExistingArtworkCandidates();

      console.log(`Search completed: ${searchResult.message}`);
    } catch (err) {
      if (err instanceof ApiError) {
        error = `${err.code}: ${err.message}`;
      } else {
        error = 'Failed to search for artwork';
      }
    } finally {
      searching = false;
    }
  }

  async function applyArtwork(candidate: ArtworkCandidate) {
    loading = true;
    error = null;

    try {
      await apiClient.post(`library/items/${itemId}/artwork/apply`, {
        candidateId: candidate.id,
        type: candidate.type,
      });

      // Mark this candidate as applied and reload the list
      candidate.isApplied = true;
      hasArtwork = true;
      dispatch('artworkUpdated', { itemId, hasArtwork: true });

      // Reload the artwork candidates to get updated state
      await loadExistingArtworkCandidates();
    } catch (err) {
      if (err instanceof ApiError) {
        error = `${err.code}: ${err.message}`;
      } else {
        error = 'Failed to apply artwork';
      }
    } finally {
      loading = false;
    }
  }

  async function uploadCustomArtwork() {
    if (!selectedFile) return;

    uploading = true;
    error = null;

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('type', 'Primary');

      await apiClient.post(`library/items/${itemId}/artwork/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      hasArtwork = true;
      selectedFile = null;
      fileInput.value = '';
      dispatch('artworkUpdated', { itemId, hasArtwork: true });

      // Reload the artwork candidates to show the uploaded artwork
      await loadExistingArtworkCandidates();
    } catch (err) {
      if (err instanceof ApiError) {
        error = `${err.code}: ${err.message}`;
      } else {
        error = 'Failed to upload artwork';
      }
    } finally {
      uploading = false;
    }
  }

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        error = 'Please select an image file';
        target.value = '';
        return;
      }

      // Validate file size (e.g., max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        error = 'File size must be less than 10MB';
        target.value = '';
        return;
      }

      selectedFile = file;
      error = null;
    }
  }

  function getArtworkTypeLabel(type: string): string {
    return artworkTypes.find((t) => t.value === type)?.label || type;
  }

  function getDimensionsText(candidate: ArtworkCandidate): string {
    if (candidate.width && candidate.height) {
      return `${candidate.width}×${candidate.height}`;
    }
    return 'Unknown dimensions';
  }
</script>

<div class="bg-card border border-border rounded-lg p-6">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-lg font-semibold">Artwork</h3>
    <div class="flex items-center gap-2">
      <div
        class="w-3 h-3 rounded-full {hasArtwork
          ? 'bg-green-500'
          : 'bg-red-500'}"
        title={hasArtwork ? 'Has artwork' : 'Missing artwork'}
      ></div>
      <span class="text-sm text-muted-foreground">
        {hasArtwork ? 'Has artwork' : 'No artwork'}
      </span>
    </div>
  </div>

  {#if error}
    <div
      class="mb-4 p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-destructive text-sm"
    >
      {error}
    </div>
  {/if}

  <!-- Current Artwork Display -->
  <div class="mb-6">
    <div
      class="aspect-[2/3] bg-muted rounded-lg flex items-center justify-center relative overflow-hidden"
    >
      {#if hasArtwork}
        <!-- TODO: Replace with actual artwork URL -->
        <div class="text-6xl opacity-50">🎨</div>
        <div
          class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"
        ></div>
        <div class="absolute bottom-2 left-2 right-2">
          <div class="text-white text-xs bg-black/50 rounded px-2 py-1">
            Current artwork
          </div>
        </div>
      {:else}
        <div class="text-center text-muted-foreground">
          <div class="text-4xl mb-2">📷</div>
          <div class="text-sm">No artwork</div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Search for Artwork -->
  <div class="space-y-4">
    <div>
      <button
        type="button"
        class="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        on:click={searchArtworkCandidates}
        disabled={searching}
      >
        {#if searching}
          <LoadingSpinner size="sm" />
        {:else}
          Search for Artwork
        {/if}
      </button>
    </div>

    <!-- Artwork Candidates -->
    {#if artworkCandidates.length > 0}
      <div class="space-y-3">
        <h4 class="font-medium text-sm">
          Found Artwork ({artworkCandidates.length})
        </h4>
        <div class="space-y-2 max-h-96 overflow-y-auto">
          {#each artworkCandidates as candidate}
            <div
              class="border border-border rounded-lg p-3 hover:bg-accent/20 transition-colors"
            >
              <div class="flex items-start gap-3">
                <div
                  class="w-16 h-24 bg-muted rounded flex-shrink-0 overflow-hidden"
                >
                  <img
                    src={candidate.url}
                    alt="Artwork preview"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-sm font-medium"
                      >{getArtworkTypeLabel(candidate.type)}</span
                    >
                    <span class="text-xs bg-accent px-2 py-1 rounded">
                      {Math.round(candidate.confidence * 100)}%
                    </span>
                  </div>
                  <div class="text-xs text-muted-foreground space-y-1">
                    <div>Provider: {candidate.provider}</div>
                    <div>{getDimensionsText(candidate)}</div>
                    {#if candidate.isApplied}
                      <div class="text-green-600">✓ Applied</div>
                    {/if}
                  </div>
                  <button
                    type="button"
                    class="mt-2 px-3 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90 transition-colors disabled:opacity-50"
                    on:click={() => applyArtwork(candidate)}
                    disabled={loading}
                  >
                    {loading ? 'Applying...' : 'Apply'}
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Upload Custom Artwork -->
    <div class="border-t border-border pt-4">
      <h4 class="font-medium text-sm mb-3">Upload Custom Artwork</h4>
      <div class="space-y-3">
        <input
          bind:this={fileInput}
          type="file"
          accept="image/*"
          class="w-full px-3 py-2 border border-border rounded-lg bg-background file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-accent file:text-accent-foreground file:hover:bg-accent/80 file:transition-colors"
          on:change={handleFileSelect}
          disabled={uploading}
        />

        {#if selectedFile}
          <div class="text-sm text-muted-foreground">
            Selected: {selectedFile.name} ({(
              selectedFile.size /
              1024 /
              1024
            ).toFixed(1)} MB)
          </div>
          <button
            type="button"
            class="w-full px-4 py-2 bg-accent hover:bg-accent/80 rounded-lg transition-colors disabled:opacity-50"
            on:click={uploadCustomArtwork}
            disabled={uploading}
          >
            {#if uploading}
              <LoadingSpinner size="sm" />
            {:else}
              Upload Artwork
            {/if}
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>
