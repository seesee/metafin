<script lang="ts">
  export let type: 'artwork' | 'sync' | 'provider' | 'metadata' | 'collection' = 'sync';
  export let status: 'success' | 'warning' | 'error' | 'loading' | 'unknown' = 'unknown';
  export let label: string = '';
  export let detail: string = '';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let showLabel: boolean = true;
  export let showDetail: boolean = false;
  export let confidence: number | undefined = undefined;
  export let count: number | undefined = undefined;

  function getStatusColor(status: string): string {
    switch (status) {
      case 'success':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      case 'loading':
        return 'bg-blue-500 animate-pulse';
      default:
        return 'bg-gray-400';
    }
  }

  function getStatusIcon(type: string, status: string): string {
    if (status === 'loading') return '⟳';

    switch (type) {
      case 'artwork':
        switch (status) {
          case 'success': return '🎨';
          case 'warning': return '🖼️';
          case 'error': return '❌';
          default: return '📷';
        }
      case 'sync':
        switch (status) {
          case 'success': return '✅';
          case 'warning': return '⚠️';
          case 'error': return '❌';
          default: return '🔄';
        }
      case 'provider':
        switch (status) {
          case 'success': return '🌐';
          case 'warning': return '⚡';
          case 'error': return '🚫';
          default: return '🔍';
        }
      case 'metadata':
        switch (status) {
          case 'success': return '📋';
          case 'warning': return '📝';
          case 'error': return '❌';
          default: return '📄';
        }
      case 'collection':
        switch (status) {
          case 'success': return '📚';
          case 'warning': return '📖';
          case 'error': return '❌';
          default: return '📂';
        }
      default:
        return '●';
    }
  }

  function getSizeClasses(size: string): { dot: string; text: string; icon: string } {
    switch (size) {
      case 'sm':
        return {
          dot: 'w-2 h-2',
          text: 'text-xs',
          icon: 'text-sm'
        };
      case 'lg':
        return {
          dot: 'w-4 h-4',
          text: 'text-sm',
          icon: 'text-lg'
        };
      default:
        return {
          dot: 'w-3 h-3',
          text: 'text-xs',
          icon: 'text-base'
        };
    }
  }

  $: sizeClasses = getSizeClasses(size);
  $: statusColor = getStatusColor(status);
  $: statusIcon = getStatusIcon(type, status);
</script>

<div class="flex items-center gap-2" role="status" aria-label="{type} status: {status}">
  <!-- Status Dot -->
  <div
    class="rounded-full {statusColor} {sizeClasses.dot}"
    title="{label || type}: {status}"
  ></div>

  <!-- Status Icon -->
  <span class="{sizeClasses.icon}" title="{label || type}: {status}">
    {statusIcon}
  </span>

  <!-- Status Text -->
  {#if showLabel || showDetail}
    <div class="flex flex-col gap-1">
      {#if showLabel && label}
        <span class="{sizeClasses.text} font-medium">
          {label}
          {#if count !== undefined}
            <span class="text-muted-foreground">({count})</span>
          {/if}
        </span>
      {/if}

      {#if showDetail && detail}
        <span class="{sizeClasses.text} text-muted-foreground">
          {detail}
          {#if confidence !== undefined}
            <span class="ml-1 px-1 py-0.5 bg-accent rounded text-xs">
              {Math.round(confidence * 100)}%
            </span>
          {/if}
        </span>
      {/if}
    </div>
  {/if}
</div>