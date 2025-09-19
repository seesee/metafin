<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { apiClient } from '$lib/api/client.js';
  import StatusIndicator from './StatusIndicator.svelte';
  import ErrorDisplay from './ErrorDisplay.svelte';

  export let showDetails: boolean = false;
  export let autoRefresh: boolean = true;
  export let refreshInterval: number = 30000; // 30 seconds

  interface HealthResponse {
    status: string;
    info: {
      metafin: {
        status: string;
        info: {
          version: string;
          uptime: number;
          startTime: string;
          environment: string;
          basePath: string;
          node: {
            version: string;
            platform: string;
            arch: string;
          };
          configuration: {
            hasJellyfinConfig: boolean;
            hasTmdbConfig: boolean;
            defaultLocale: string;
          };
          endpoints: {
            jellyfin: {
              url: string;
              apiKeyConfigured: boolean;
              apiKeyPreview: string;
            };
            backend: {
              port: string;
              basePath: string;
            };
          };
        };
      };
      database: {
        status: string;
        info: {
          stats: {
            itemCount: number;
            libraryCount: number;
            collectionCount: number;
            jobCount: number;
          };
        };
      };
      jellyfin: {
        status: string;
        info: {
          version: string;
          serverName: string;
          operatingSystem: string;
        };
      };
    };
    error: Record<string, any>;
    details: Record<string, any>;
  }

  interface ProviderConfig {
    type: string;
    enabled: boolean;
    rateLimit: number;
    timeout: number;
  }

  let healthData: HealthResponse | null = null;
  let providerConfigs: ProviderConfig[] = [];
  let loading = true;
  let lastUpdate = new Date();
  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  let errors: string[] = [];
  let responseTime = 0;

  onMount(() => {
    checkSystemHealth();
    if (autoRefresh) {
      refreshTimer = setInterval(checkSystemHealth, refreshInterval);
    }
  });

  onDestroy(() => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
  });

  async function checkSystemHealth() {
    loading = true;
    errors = [];
    const startTime = Date.now();

    try {
      // Check main health endpoint
      const [health, providers] = await Promise.all([
        apiClient.getHealth(),
        apiClient.getProviderConfigs()
      ]);

      responseTime = Date.now() - startTime;
      healthData = health;
      providerConfigs = providers;
      lastUpdate = new Date();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error during health check';
      errors.push(errorMsg);
      console.error('System health check failed:', error);
      responseTime = Date.now() - startTime;
    } finally {
      loading = false;
    }
  }

  function formatResponseTime(ms: number): string {
    if (ms < 100) return `${ms}ms`;
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  function getOverallStatus(): 'success' | 'warning' | 'error' {
    if (!healthData) return 'error';

    if (healthData.status !== 'ok') return 'error';

    const hasJellyfinError = healthData.info.jellyfin.status !== 'up';
    const hasDatabaseError = healthData.info.database.status !== 'up';
    const hasMetafinError = healthData.info.metafin.status !== 'up';

    if (hasJellyfinError || hasDatabaseError || hasMetafinError) return 'error';

    // Check if required configuration is missing
    const hasProviders = providerConfigs.length > 0 && providerConfigs.some(p => p.enabled);
    const hasJellyfinConfig = healthData.info.metafin.info.configuration.hasJellyfinConfig;

    if (!hasJellyfinConfig) return 'error'; // Jellyfin config is required
    if (!hasProviders) return 'warning'; // Providers are strongly recommended

    // Check if system appears to be in initial state (libraries but no items)
    const hasLibraries = healthData.info.database.info.stats.libraryCount > 0;
    const hasItems = healthData.info.database.info.stats.itemCount > 0;

    // If we have libraries but no items, show warning (likely needs sync)
    if (hasLibraries && !hasItems) return 'warning';

    return 'success';
  }

  function getStatusFromHealth(status: string): 'success' | 'warning' | 'error' {
    return status === 'up' ? 'success' : 'error';
  }

  function getProviderStatus(): 'success' | 'warning' | 'error' {
    if (providerConfigs.length === 0) return 'error';
    const enabledProviders = providerConfigs.filter(p => p.enabled);
    if (enabledProviders.length === 0) return 'error';
    if (enabledProviders.length < providerConfigs.length) return 'warning';
    return 'success';
  }
</script>

<div class="bg-card border border-border rounded-lg p-4">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-lg font-semibold flex items-center gap-2">
      <StatusIndicator
        type="metadata"
        status={getOverallStatus()}
        size="md"
        showLabel={false}
      />
      System Status
    </h3>

    <div class="flex items-center gap-2">
      <span class="text-xs text-muted-foreground">
        Last updated: {lastUpdate.toLocaleTimeString('en-GB')}
      </span>
      <button
        type="button"
        class="px-2 py-1 text-xs border border-border rounded hover:bg-accent transition-colors"
        on:click={checkSystemHealth}
        disabled={loading}
      >
        {loading ? '🔄' : '↻'} Refresh
      </button>
      <button
        type="button"
        class="px-2 py-1 text-xs border border-border rounded hover:bg-accent transition-colors"
        on:click={() => showDetails = !showDetails}
      >
        {showDetails ? 'Hide' : 'Show'} Details
      </button>
    </div>
  </div>

  <!-- Error Display -->
  {#each errors as error}
    <ErrorDisplay
      {error}
      title="System Health Check Failed"
      context="System Status Panel"
      variant="critical"
      onRetry={checkSystemHealth}
    />
  {/each}

  {#if loading}
    <div class="flex items-center justify-center py-8">
      <div class="flex items-center gap-2 text-muted-foreground">
        <div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        Checking system health...
      </div>
    </div>
  {:else if healthData}
    <!-- Quick Status Overview -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
      <div class="flex items-center gap-2">
        <StatusIndicator
          type="metadata"
          status={getStatusFromHealth(healthData.info.metafin.status)}
          label="Backend API"
          detail={formatResponseTime(responseTime)}
          size="sm"
          showLabel={true}
          showDetail={true}
        />
      </div>

      <div class="flex items-center gap-2">
        <StatusIndicator
          type="provider"
          status={getStatusFromHealth(healthData.info.jellyfin.status)}
          label="Jellyfin"
          detail={healthData.info.jellyfin.info.version || 'Unknown'}
          size="sm"
          showLabel={true}
          showDetail={true}
        />
      </div>

      <div class="flex items-center gap-2">
        <StatusIndicator
          type="sync"
          status={getStatusFromHealth(healthData.info.database.status)}
          label="Database"
          size="sm"
          showLabel={true}
        />
      </div>

      <div class="flex items-center gap-2">
        <StatusIndicator
          type="provider"
          status={getProviderStatus()}
          label="Providers"
          count={providerConfigs.filter(p => p.enabled).length}
          size="sm"
          showLabel={true}
        />
      </div>
    </div>

    <!-- Statistics -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm mb-4">
      <div class="p-2 bg-muted rounded">
        <div class="font-bold text-lg">{healthData.info.database.info.stats.libraryCount}</div>
        <div class="text-muted-foreground">Libraries</div>
      </div>
      <div class="p-2 bg-muted rounded">
        <div class="font-bold text-lg">{healthData.info.database.info.stats.itemCount.toLocaleString()}</div>
        <div class="text-muted-foreground">Total Items</div>
      </div>
      <div class="p-2 bg-muted rounded">
        <div class="font-bold text-lg">{healthData.info.database.info.stats.collectionCount.toLocaleString()}</div>
        <div class="text-muted-foreground">Collections</div>
      </div>
      <div class="p-2 bg-muted rounded">
        <div class="font-bold text-lg">{formatUptime(healthData.info.metafin.info.uptime)}</div>
        <div class="text-muted-foreground">Uptime</div>
      </div>
    </div>

    <!-- Detailed Status -->
    {#if showDetails}
      <div class="space-y-4 border-t pt-4">
        <!-- Backend Details -->
        <div class="p-3 border border-border rounded">
          <h4 class="font-medium mb-2 flex items-center gap-2">
            <StatusIndicator
              type="metadata"
              status={getStatusFromHealth(healthData.info.metafin.status)}
              size="sm"
              showLabel={false}
            />
            Backend Status
          </h4>
          <div class="text-sm space-y-1">
            <div>Version: {healthData.info.metafin.info.version}</div>
            <div>Environment: {healthData.info.metafin.info.environment}</div>
            <div>Response Time: {formatResponseTime(responseTime)}</div>
            <div>Port: {healthData.info.metafin.info.endpoints.backend.port}</div>
            <div>Base Path: {healthData.info.metafin.info.basePath}</div>
            <div>Node: {healthData.info.metafin.info.node.version} ({healthData.info.metafin.info.node.platform}/{healthData.info.metafin.info.node.arch})</div>
            <div>Started: {new Date(healthData.info.metafin.info.startTime).toLocaleString('en-GB')}</div>
          </div>
        </div>

        <!-- Jellyfin Details -->
        <div class="p-3 border border-border rounded">
          <h4 class="font-medium mb-2 flex items-center gap-2">
            <StatusIndicator
              type="provider"
              status={getStatusFromHealth(healthData.info.jellyfin.status)}
              size="sm"
              showLabel={false}
            />
            Jellyfin Connection
          </h4>
          <div class="text-sm space-y-1">
            <div>Status: {healthData.info.jellyfin.status === 'up' ? '✅ Connected' : '❌ Disconnected'}</div>
            <div>Server: {healthData.info.jellyfin.info.serverName || 'Unknown'}</div>
            <div>Version: {healthData.info.jellyfin.info.version}</div>
            <div>URL: {healthData.info.metafin.info.endpoints.jellyfin.url}</div>
            <div>API Key: {healthData.info.metafin.info.endpoints.jellyfin.apiKeyConfigured ?
              `Configured (${healthData.info.metafin.info.endpoints.jellyfin.apiKeyPreview})` :
              '❌ Not configured'}</div>
          </div>
        </div>

        <!-- Database Details -->
        <div class="p-3 border border-border rounded">
          <h4 class="font-medium mb-2 flex items-center gap-2">
            <StatusIndicator
              type="sync"
              status={getStatusFromHealth(healthData.info.database.status)}
              size="sm"
              showLabel={false}
            />
            Database Status
          </h4>
          <div class="text-sm space-y-1">
            <div>Status: {healthData.info.database.status === 'up' ? '✅ Connected' : '❌ Disconnected'}</div>
            <div>Libraries: {healthData.info.database.info.stats.libraryCount}</div>
            <div>Items: {healthData.info.database.info.stats.itemCount.toLocaleString()}</div>
            <div>Collections: {healthData.info.database.info.stats.collectionCount}</div>
            <div>Jobs: {healthData.info.database.info.stats.jobCount}</div>
          </div>
        </div>

        <!-- Providers Details -->
        <div class="p-3 border border-border rounded">
          <h4 class="font-medium mb-2 flex items-center gap-2">
            <StatusIndicator
              type="provider"
              status={getProviderStatus()}
              size="sm"
              showLabel={false}
            />
            Metadata Providers
          </h4>
          <div class="text-sm space-y-2">
            <div>Total: {providerConfigs.length} configured, {providerConfigs.filter(p => p.enabled).length} enabled</div>
            {#each providerConfigs as provider}
              <div class="flex items-center justify-between p-2 bg-muted/50 rounded">
                <div class="flex items-center gap-2">
                  <StatusIndicator
                    type="provider"
                    status={provider.enabled ? 'success' : 'error'}
                    size="xs"
                    showLabel={false}
                  />
                  <span class="font-medium capitalize">{provider.type}</span>
                </div>
                <div class="text-xs text-muted-foreground">
                  {provider.enabled ? 'Enabled' : 'Disabled'} •
                  {provider.rateLimit}/sec •
                  {provider.timeout/1000}s timeout
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Configuration Details -->
        <div class="p-3 border border-border rounded">
          <h4 class="font-medium mb-2">Configuration</h4>
          <div class="text-sm space-y-1">
            <div>Jellyfin Config: {healthData.info.metafin.info.configuration.hasJellyfinConfig ? '✅ Configured' : '❌ Missing'}</div>
            <div>TMDb Config: {healthData.info.metafin.info.configuration.hasTmdbConfig ? '✅ Configured' : '❌ Not configured'}</div>
            <div>Default Locale: {healthData.info.metafin.info.configuration.defaultLocale}</div>
          </div>
        </div>
      </div>
    {/if}
  {:else}
    <div class="text-center py-8">
      <div class="text-muted-foreground">
        Unable to load system status
      </div>
    </div>
  {/if}
</div>