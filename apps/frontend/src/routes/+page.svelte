<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient, ApiError } from '$lib/api/client.js';

  let healthData: {
    metafin: { status: string; info: unknown };
    database: { status: string; info: unknown };
  } | null = null;
  let helloData: { message: string; timestamp: string } | null = null;
  let loading = true;
  let error: string | null = null;

  onMount(async () => {
    try {
      // Test both endpoints
      const [health, hello] = await Promise.all([
        apiClient.getHealth(),
        apiClient.getHello(),
      ]);

      healthData = health;
      helloData = hello;
    } catch (err) {
      if (err instanceof ApiError) {
        error = `${err.code}: ${err.message}`;
      } else {
        error = 'Failed to connect to backend';
      }
    } finally {
      loading = false;
    }
  });

  function formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
</script>

<svelte:head>
  <title>metafin - Jellyfin Metadata Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-4xl">
  <header class="mb-8 text-center">
    <h1
      class="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
    >
      metafin
    </h1>
    <p class="text-xl text-muted-foreground">
      A comprehensive metadata management tool for Jellyfin
    </p>
  </header>

  <div class="grid gap-6 md:grid-cols-2">
    <!-- Hello Card -->
    <div class="rounded-lg border bg-card p-6">
      <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-green-500"></span>
        Backend Status
      </h2>

      {#if loading}
        <div class="flex items-center gap-2 text-muted-foreground">
          <div
            class="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"
          ></div>
          Connecting to backend...
        </div>
      {:else if error}
        <div class="text-destructive">
          <p class="font-medium">Connection Failed</p>
          <p class="text-sm">{error}</p>
        </div>
      {:else if helloData}
        <div class="space-y-2">
          <p class="text-green-600 font-medium">{helloData.message}</p>
          <p class="text-sm text-muted-foreground">
            Response received at {new Date(helloData.timestamp).toLocaleString(
              'en-GB'
            )}
          </p>
        </div>
      {/if}
    </div>

    <!-- Health Card -->
    <div class="rounded-lg border bg-card p-6">
      <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
        <span
          class="w-2 h-2 rounded-full {healthData?.metafin?.status === 'up'
            ? 'bg-green-500'
            : 'bg-red-500'}"
        ></span>
        System Health
      </h2>

      {#if loading}
        <div class="flex items-center gap-2 text-muted-foreground">
          <div
            class="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"
          ></div>
          Loading health data...
        </div>
      {:else if error}
        <div class="text-destructive">
          <p>Health check unavailable</p>
        </div>
      {:else if healthData}
        <div class="space-y-3">
          <!-- Application Info -->
          {#if healthData.metafin}
            <div>
              <p class="font-medium">Application</p>
              <div class="text-sm text-muted-foreground space-y-1">
                <p>Version: {healthData.metafin.info.version}</p>
                <p>Environment: {healthData.metafin.info.environment}</p>
                <p>Uptime: {formatUptime(healthData.metafin.info.uptime)}</p>
                {#if healthData.metafin.info.basePath !== '/'}
                  <p>Base Path: {healthData.metafin.info.basePath}</p>
                {/if}
              </div>
            </div>
          {/if}

          <!-- Database Info -->
          {#if healthData.database}
            <div>
              <p class="font-medium flex items-center gap-2">
                Database
                <span
                  class="w-2 h-2 rounded-full {healthData.database.status ===
                  'up'
                    ? 'bg-green-500'
                    : 'bg-red-500'}"
                ></span>
              </p>
              {#if healthData.database.info.stats}
                <div
                  class="text-sm text-muted-foreground grid grid-cols-2 gap-1"
                >
                  <p>
                    Items: {healthData.database.info.stats.itemCount.toLocaleString()}
                  </p>
                  <p>
                    Libraries: {healthData.database.info.stats.libraryCount}
                  </p>
                  <p>
                    Collections: {healthData.database.info.stats
                      .collectionCount}
                  </p>
                  <p>Jobs: {healthData.database.info.stats.jobCount}</p>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Configuration Status -->
          {#if healthData.metafin?.info?.configuration}
            <div>
              <p class="font-medium">Configuration</p>
              <div class="text-sm text-muted-foreground space-y-1">
                <div class="flex items-center gap-2">
                  <span
                    class="w-2 h-2 rounded-full {healthData.metafin.info
                      .configuration.hasJellyfinConfig
                      ? 'bg-green-500'
                      : 'bg-yellow-500'}"
                  ></span>
                  Jellyfin: {healthData.metafin.info.configuration
                    .hasJellyfinConfig
                    ? 'Configured'
                    : 'Not configured'}
                </div>
                <div class="flex items-center gap-2">
                  <span
                    class="w-2 h-2 rounded-full {healthData.metafin.info
                      .configuration.hasTmdbConfig
                      ? 'bg-green-500'
                      : 'bg-gray-400'}"
                  ></span>
                  TMDb: {healthData.metafin.info.configuration.hasTmdbConfig
                    ? 'Configured'
                    : 'Optional'}
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- Getting Started -->
  <section class="mt-8 rounded-lg border bg-card p-6">
    <h2 class="text-xl font-semibold mb-4">Getting Started</h2>
    <div class="prose prose-sm max-w-none text-muted-foreground">
      <p>
        metafin is a comprehensive metadata management tool for Jellyfin that
        helps you maintain accurate metadata for your media library.
      </p>

      <h3 class="text-foreground font-medium">Key Features</h3>
      <ul>
        <li>
          <strong>Provider Integration:</strong> Search and match content using TVMaze,
          Wikidata, and TMDb
        </li>
        <li>
          <strong>Bulk Operations:</strong> Apply metadata changes to multiple items
          with preview
        </li>
        <li>
          <strong>Smart Collections:</strong> Create rule-based collections that
          update automatically
        </li>
        <li>
          <strong>Artwork Management:</strong> Download and apply high-quality artwork
        </li>
        <li>
          <strong>Misclassification Detection:</strong> Identify and resolve incorrectly
          categorised content
        </li>
      </ul>

      <h3 class="text-foreground font-medium">Next Steps</h3>
      <ol>
        <li>Configure your Jellyfin server connection in Settings</li>
        <li>Run an initial library sync to populate the database</li>
        <li>Start managing your metadata with the dashboard tools</li>
      </ol>
    </div>
  </section>
</div>

<style>
  .prose h3 {
    @apply text-base mt-4 mb-2;
  }

  .prose ul,
  .prose ol {
    @apply my-2;
  }

  .prose li {
    @apply my-1;
  }
</style>
