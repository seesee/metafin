<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/api/client.js';
  import StatusIndicator from '$lib/components/StatusIndicator.svelte';
  import ErrorDisplay from '$lib/components/ErrorDisplay.svelte';
  import SystemStatus from '$lib/components/SystemStatus.svelte';

  interface SystemConfig {
    jellyfin: {
      url: string;
      apiKey: string;
      connected: boolean;
      serverName?: string;
      version?: string;
    };
    tmdb: {
      apiKey: string;
      configured: boolean;
    };
    backend: {
      port: string;
      basePath: string;
      version: string;
      environment: string;
    };
  }

  let config: SystemConfig = {
    jellyfin: {
      url: '',
      apiKey: '',
      connected: false
    },
    tmdb: {
      apiKey: '',
      configured: false
    },
    backend: {
      port: '8080',
      basePath: '/',
      version: '0.1.0',
      environment: 'development'
    }
  };

  let loading = true;
  let saving = false;
  let testing = false;
  let errors: string[] = [];
  let successMessage = '';
  let testResults: { service: string; status: 'success' | 'error'; message: string }[] = [];

  // Form state
  let jellyfinUrl = '';
  let jellyfinApiKey = '';
  let tmdbApiKey = '';

  onMount(async () => {
    await loadConfiguration();
  });

  async function loadConfiguration() {
    loading = true;
    errors = [];

    try {
      // Load configuration from the configuration endpoint
      const [healthData, configData] = await Promise.all([
        apiClient.getHealth(),
        apiClient.getConfiguration()
      ]);

      // Extract configuration from both health and config data
      config.jellyfin.url = configData.jellyfin.url || healthData.info?.metafin?.info?.endpoints?.jellyfin?.url || '';
      config.jellyfin.apiKey = configData.jellyfin.apiKey ? 'Configured (saved)' : '';
      config.jellyfin.connected = healthData.info?.jellyfin?.status === 'up';
      config.jellyfin.serverName = healthData.info?.jellyfin?.info?.serverName;
      config.jellyfin.version = healthData.info?.jellyfin?.info?.version;

      config.tmdb.configured = !!(configData.tmdb.apiKey || healthData.info?.metafin?.info?.configuration?.hasTmdbConfig);

      config.backend.port = healthData.info?.metafin?.info?.endpoints?.backend?.port || '8080';
      config.backend.basePath = healthData.info?.metafin?.info?.basePath || '/';
      config.backend.version = healthData.info?.metafin?.info?.version || '0.1.0';
      config.backend.environment = healthData.info?.metafin?.info?.environment || 'development';

      // Set form values - populate with saved configuration
      jellyfinUrl = configData.jellyfin.url || config.jellyfin.url;
      // Don't populate API keys for security, but show placeholders if they exist
      jellyfinApiKey = '';
      tmdbApiKey = '';

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to load configuration';
      errors.push(errorMsg);
      console.error('Failed to load configuration:', error);
    } finally {
      loading = false;
    }
  }

  async function testConnection(service: 'jellyfin' | 'tmdb') {
    testing = true;
    testResults = testResults.filter(r => r.service !== service);

    try {
      if (service === 'jellyfin') {
        if (!jellyfinUrl.trim() || !jellyfinApiKey.trim()) {
          testResults.push({
            service: 'jellyfin',
            status: 'error',
            message: 'Jellyfin URL and API key are required'
          });
          return;
        }

        // Use the backend test connection endpoint
        const result = await apiClient.testConnection('jellyfin', {
          url: jellyfinUrl,
          apiKey: jellyfinApiKey
        });

        testResults.push({
          service: 'jellyfin',
          status: result.success ? 'success' : 'error',
          message: result.message
        });
      } else if (service === 'tmdb') {
        if (!tmdbApiKey.trim()) {
          testResults.push({
            service: 'tmdb',
            status: 'error',
            message: 'TMDb API key is required'
          });
          return;
        }

        // Use the backend test connection endpoint
        const result = await apiClient.testConnection('tmdb', {
          apiKey: tmdbApiKey
        });

        testResults.push({
          service: 'tmdb',
          status: result.success ? 'success' : 'error',
          message: result.message
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Connection test failed';
      testResults.push({
        service,
        status: 'error',
        message: errorMsg
      });
    } finally {
      testing = false;
    }
  }

  async function saveConfiguration() {
    saving = true;
    errors = [];
    successMessage = '';

    try {
      // Build the configuration update object
      const configUpdate: any = {};

      // Update Jellyfin configuration if values are provided
      if (jellyfinUrl.trim() || jellyfinApiKey.trim()) {
        configUpdate.jellyfin = {};
        if (jellyfinUrl.trim()) {
          configUpdate.jellyfin.url = jellyfinUrl.trim();
        }
        if (jellyfinApiKey.trim()) {
          configUpdate.jellyfin.apiKey = jellyfinApiKey.trim();
        }
      }

      // Update TMDb configuration if API key is provided
      if (tmdbApiKey.trim()) {
        configUpdate.tmdb = {
          apiKey: tmdbApiKey.trim()
        };
      }

      // Only save if there are actual changes
      if (Object.keys(configUpdate).length === 0) {
        errors.push('No configuration changes to save');
        return;
      }

      // Save configuration using the backend endpoint
      const result = await apiClient.updateConfiguration(configUpdate);

      if (result.success) {
        successMessage = result.requiresRestart
          ? `Configuration saved successfully! Updated: ${result.updated.join(', ')}. Restart may be required for some changes.`
          : `Configuration saved successfully! Updated: ${result.updated.join(', ')}. No restart required.`;

        // Clear only API key fields after successful save (preserve URLs)
        jellyfinApiKey = '';
        tmdbApiKey = '';

        // Reload configuration to show the updated values
        await loadConfiguration();

        // Re-populate URL if it was saved
        if (configUpdate.jellyfin?.url) {
          jellyfinUrl = configUpdate.jellyfin.url;
        }
      } else {
        errors.push('Failed to save configuration');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to save configuration';
      errors.push(errorMsg);
      console.error('Failed to save configuration:', error);
    } finally {
      saving = false;
    }
  }

  function clearMessages() {
    errors = [];
    successMessage = '';
    testResults = [];
  }

  async function reloadConfiguration() {
    saving = true;
    errors = [];
    successMessage = '';

    try {
      const result = await apiClient.reloadConfiguration();

      if (result.success) {
        successMessage = `Configuration reloaded successfully! Services reloaded: ${result.reloaded.join(', ') || 'none'}`;
        // Reload the page configuration to reflect any changes
        await loadConfiguration();
      } else {
        errors.push('Failed to reload configuration');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to reload configuration';
      errors.push(errorMsg);
      console.error('Failed to reload configuration:', error);
    } finally {
      saving = false;
    }
  }

  function getTestResult(service: string) {
    return testResults.find(r => r.service === service);
  }
</script>

<svelte:head>
  <title>Settings - metafin</title>
</svelte:head>

<div class="container mx-auto px-6 py-8 max-w-4xl">
  <div class="mb-8">
    <h1 class="text-3xl font-bold">Settings</h1>
    <p class="text-muted-foreground mt-2">
      Configure endpoints, API keys, and system preferences
    </p>
  </div>

  <!-- System Status Overview -->
  <div class="mb-8">
    <SystemStatus showDetails={false} />
  </div>

  <!-- Error Display -->
  {#each errors as error}
    <ErrorDisplay
      {error}
      title="Configuration Error"
      context="Settings Page"
      variant="error"
      onRetry={loadConfiguration}
    />
  {/each}

  <!-- Success Message -->
  {#if successMessage}
    <div class="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
      <div class="flex items-center gap-2 text-green-600">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
        </svg>
        {successMessage}
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="flex items-center gap-2 text-muted-foreground">
        <div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        Loading configuration...
      </div>
    </div>
  {:else}
    <div class="space-y-8">
      <!-- Jellyfin Configuration -->
      <div class="bg-card border border-border rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <StatusIndicator
            type="provider"
            status={config.jellyfin.connected ? 'success' : 'error'}
            size="md"
            showLabel={false}
          />
          <h2 class="text-xl font-semibold">Jellyfin Configuration</h2>
        </div>

        <div class="grid md:grid-cols-2 gap-6">
          <div>
            <div class="space-y-4">
              <div>
                <label for="jellyfin-url" class="block text-sm font-medium mb-2">
                  Server URL
                </label>
                <input
                  id="jellyfin-url"
                  type="url"
                  bind:value={jellyfinUrl}
                  placeholder="https://jellyfin.example.com"
                  class="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  on:input={clearMessages}
                />
              </div>

              <div>
                <label for="jellyfin-api-key" class="block text-sm font-medium mb-2">
                  API Key
                </label>
                <input
                  id="jellyfin-api-key"
                  type="password"
                  bind:value={jellyfinApiKey}
                  placeholder="Enter API key..."
                  class="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  on:input={clearMessages}
                />
                <p class="text-xs text-muted-foreground mt-1">
                  Current: {config.jellyfin.apiKey ? (config.jellyfin.apiKey.includes('***') ? 'Configured (saved)' : config.jellyfin.apiKey) : 'Not configured'}
                </p>
              </div>

              <button
                type="button"
                class="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors disabled:opacity-50"
                on:click={() => testConnection('jellyfin')}
                disabled={testing || !jellyfinUrl.trim() || !jellyfinApiKey.trim()}
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
          </div>

          <div>
            <h3 class="font-medium mb-2">Current Status</h3>
            <div class="text-sm space-y-2">
              <div>
                Status: {config.jellyfin.connected ?
                  '✅ Connected' :
                  '❌ Not connected'}
              </div>
              {#if config.jellyfin.serverName}
                <div>Server: {config.jellyfin.serverName}</div>
              {/if}
              {#if config.jellyfin.version}
                <div>Version: {config.jellyfin.version}</div>
              {/if}
              <div>URL: {config.jellyfin.url || 'Not configured'}</div>
            </div>

            {#if getTestResult('jellyfin')}
              <div class="mt-4 p-3 rounded border {getTestResult('jellyfin')?.status === 'success' ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}">
                <div class="flex items-center gap-2 text-sm {getTestResult('jellyfin')?.status === 'success' ? 'text-green-600' : 'text-red-600'}">
                  <StatusIndicator
                    type="provider"
                    status={getTestResult('jellyfin')?.status || 'error'}
                    size="xs"
                    showLabel={false}
                  />
                  {getTestResult('jellyfin')?.message}
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- TMDb Configuration -->
      <div class="bg-card border border-border rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <StatusIndicator
            type="provider"
            status={config.tmdb.configured ? 'success' : 'warning'}
            size="md"
            showLabel={false}
          />
          <h2 class="text-xl font-semibold">TMDb Configuration</h2>
          <span class="text-xs bg-muted px-2 py-1 rounded">Optional</span>
        </div>

        <div class="grid md:grid-cols-2 gap-6">
          <div>
            <div class="space-y-4">
              <div>
                <label for="tmdb-api-key" class="block text-sm font-medium mb-2">
                  API Key
                </label>
                <input
                  id="tmdb-api-key"
                  type="password"
                  bind:value={tmdbApiKey}
                  placeholder="Enter TMDb API key..."
                  class="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  on:input={clearMessages}
                />
                <p class="text-xs text-muted-foreground mt-1">
                  Get your API key from <a href="https://www.themoviedb.org/settings/api" target="_blank" class="text-primary hover:underline">TMDb API settings</a>
                </p>
              </div>

              <button
                type="button"
                class="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors disabled:opacity-50"
                on:click={() => testConnection('tmdb')}
                disabled={testing || !tmdbApiKey.trim()}
              >
                {testing ? 'Testing...' : 'Test API Key'}
              </button>
            </div>
          </div>

          <div>
            <h3 class="font-medium mb-2">Current Status</h3>
            <div class="text-sm space-y-2">
              <div>
                Status: {config.tmdb.configured ?
                  '✅ Configured' :
                  '⚠️ Not configured'}
              </div>
              <div class="text-muted-foreground">
                TMDb provides additional metadata and artwork for movies and TV shows.
              </div>
            </div>

            {#if getTestResult('tmdb')}
              <div class="mt-4 p-3 rounded border {getTestResult('tmdb')?.status === 'success' ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}">
                <div class="flex items-center gap-2 text-sm {getTestResult('tmdb')?.status === 'success' ? 'text-green-600' : 'text-red-600'}">
                  <StatusIndicator
                    type="provider"
                    status={getTestResult('tmdb')?.status || 'error'}
                    size="xs"
                    showLabel={false}
                  />
                  {getTestResult('tmdb')?.message}
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Backend Information -->
      <div class="bg-card border border-border rounded-lg p-6">
        <h2 class="text-xl font-semibold mb-4">Backend Information</h2>

        <div class="grid md:grid-cols-2 gap-6">
          <div>
            <h3 class="font-medium mb-2">Configuration</h3>
            <div class="text-sm space-y-2">
              <div>Version: {config.backend.version}</div>
              <div>Environment: {config.backend.environment}</div>
              <div>Port: {config.backend.port}</div>
              <div>Base Path: {config.backend.basePath}</div>
            </div>
          </div>

          <div>
            <h3 class="font-medium mb-2">Endpoints</h3>
            <div class="text-sm space-y-2">
              <div>Frontend: <code>http://localhost:3000/</code></div>
              <div>Backend API: <code>http://localhost:{config.backend.port}/api</code></div>
              <div>Health Check: <code>http://localhost:{config.backend.port}/api/health</code></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Save Configuration -->
      <div class="flex items-center justify-between border-t pt-6">
        <div class="text-sm text-muted-foreground">
          <p><strong>Note:</strong> Configuration changes are saved to the backend configuration file.</p>
          <p>Environment variables will override saved configuration values.</p>
        </div>

        <div class="flex gap-3">
          <button
            type="button"
            class="px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
            on:click={loadConfiguration}
            disabled={loading}
          >
            Refresh
          </button>

          <button
            type="button"
            class="px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
            on:click={reloadConfiguration}
            disabled={saving}
          >
            {saving ? 'Reloading...' : 'Reload Backend Config'}
          </button>

          <button
            type="button"
            class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            on:click={saveConfiguration}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>