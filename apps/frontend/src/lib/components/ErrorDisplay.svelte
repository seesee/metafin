<script lang="ts">
  export let error: string | Error | null = null;
  export let title: string = 'Error';
  export let context: string = '';
  export let showDetails: boolean = true;
  export let showStack: boolean = false;
  export let onRetry: (() => void) | null = null;
  export let onDismiss: (() => void) | null = null;
  export let persistent: boolean = false;
  export let variant: 'error' | 'warning' | 'critical' = 'error';

  let dismissed = false;
  let showFullDetails = false;

  $: errorMessage = error instanceof Error ? error.message : (error || 'Unknown error');
  $: errorStack = error instanceof Error ? error.stack : null;
  $: timestamp = new Date().toLocaleString('en-GB');

  function getVariantClasses() {
    switch (variant) {
      case 'critical':
        return {
          container: 'bg-red-50 border-red-500 dark:bg-red-950 dark:border-red-400',
          title: 'text-red-900 dark:text-red-100',
          text: 'text-red-800 dark:text-red-200',
          icon: '🚨',
          pulse: 'animate-pulse'
        };
      case 'warning':
        return {
          container: 'bg-yellow-50 border-yellow-400 dark:bg-yellow-950 dark:border-yellow-500',
          title: 'text-yellow-900 dark:text-yellow-100',
          text: 'text-yellow-800 dark:text-yellow-200',
          icon: '⚠️',
          pulse: ''
        };
      default:
        return {
          container: 'bg-red-50 border-red-400 dark:bg-red-950 dark:border-red-500',
          title: 'text-red-900 dark:text-red-100',
          text: 'text-red-800 dark:text-red-200',
          icon: '❌',
          pulse: ''
        };
    }
  }

  $: variantClasses = getVariantClasses();

  function handleDismiss() {
    if (onDismiss) {
      onDismiss();
    } else if (!persistent) {
      dismissed = true;
    }
  }

  function copyErrorToClipboard() {
    const errorInfo = {
      timestamp,
      title,
      context,
      message: errorMessage,
      stack: errorStack
    };
    navigator.clipboard.writeText(JSON.stringify(errorInfo, null, 2));
  }
</script>

{#if error && !dismissed}
  <div class="border-l-4 p-4 mb-4 {variantClasses.container} {variantClasses.pulse}" role="alert">
    <div class="flex items-start">
      <div class="flex-shrink-0">
        <span class="text-xl" aria-hidden="true">{variantClasses.icon}</span>
      </div>
      <div class="ml-3 flex-1">
        <!-- Error Header -->
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-bold {variantClasses.title}">
            {title}
            {#if context}
              <span class="font-normal">in {context}</span>
            {/if}
          </h3>

          <!-- Action Buttons -->
          <div class="flex items-center space-x-2">
            {#if showDetails}
              <button
                type="button"
                class="text-xs {variantClasses.text} hover:underline"
                on:click={() => showFullDetails = !showFullDetails}
              >
                {showFullDetails ? 'Hide' : 'Show'} Details
              </button>
            {/if}

            <button
              type="button"
              class="text-xs {variantClasses.text} hover:underline"
              on:click={copyErrorToClipboard}
              title="Copy error details to clipboard"
            >
              📋 Copy
            </button>

            {#if onRetry}
              <button
                type="button"
                class="px-2 py-1 text-xs bg-white border border-current rounded {variantClasses.text} hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700"
                on:click={onRetry}
              >
                🔄 Retry
              </button>
            {/if}

            {#if !persistent}
              <button
                type="button"
                class="text-xs {variantClasses.text} hover:underline"
                on:click={handleDismiss}
              >
                ✕ Dismiss
              </button>
            {/if}
          </div>
        </div>

        <!-- Error Message -->
        <div class="text-sm {variantClasses.text}">
          <p class="font-medium mb-1">{errorMessage}</p>

          <!-- Timestamp -->
          <p class="text-xs opacity-75 mb-2">
            🕒 {timestamp}
          </p>

          <!-- Detailed Information -->
          {#if showDetails && showFullDetails}
            <div class="mt-3 p-3 bg-white bg-opacity-50 rounded border dark:bg-gray-800 dark:bg-opacity-50">
              {#if context}
                <div class="mb-2">
                  <strong class="text-xs">Context:</strong>
                  <code class="text-xs ml-1 px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">{context}</code>
                </div>
              {/if}

              {#if error instanceof Error}
                <div class="mb-2">
                  <strong class="text-xs">Error Type:</strong>
                  <code class="text-xs ml-1 px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">{error.constructor.name}</code>
                </div>
              {/if}

              {#if showStack && errorStack}
                <div class="mb-2">
                  <strong class="text-xs">Stack Trace:</strong>
                  <pre class="text-xs mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto whitespace-pre-wrap font-mono">{errorStack}</pre>
                </div>
              {/if}

              <!-- Browser Info -->
              <div class="text-xs opacity-75 border-t pt-2 mt-2">
                <div>User Agent: {navigator.userAgent}</div>
                <div>URL: {window.location.href}</div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}