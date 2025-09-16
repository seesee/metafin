<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let placeholder = 'Search...';
  export let value = '';
  export let disabled = false;

  const dispatch = createEventDispatcher<{ search: string }>();

  let debounceTimer: ReturnType<typeof setTimeout>;

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value = target.value;

    // Debounce search to avoid excessive API calls
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      dispatch('search', value);
    }, 300);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      clearTimeout(debounceTimer);
      dispatch('search', value);
    }
  }

  function clearSearch() {
    value = '';
    dispatch('search', '');
  }
</script>

<div class="relative">
  <div class="relative">
    <div
      class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"
    >
      <svg
        class="w-4 h-4 text-muted-foreground"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 20 20"
      >
        <path
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"
        />
      </svg>
    </div>

    <input
      type="text"
      bind:value
      {placeholder}
      {disabled}
      class="w-full pl-10 pr-10 py-3 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
      on:input={handleInput}
      on:keydown={handleKeyDown}
      aria-label={placeholder}
    />

    {#if value}
      <button
        type="button"
        class="absolute inset-y-0 right-0 flex items-center pr-3 hover:text-foreground text-muted-foreground transition-colors"
        on:click={clearSearch}
        aria-label="Clear search"
      >
        <svg
          class="w-4 h-4"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 14 14"
        >
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
          />
        </svg>
      </button>
    {/if}
  </div>
</div>
