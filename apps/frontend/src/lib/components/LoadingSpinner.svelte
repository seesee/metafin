<script lang="ts">
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let text: string = '';

  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };
</script>

<div
  class="flex items-center gap-3"
  role="status"
  aria-label={text || 'Loading'}
>
  <div
    class="animate-spin border-2 border-primary border-t-transparent rounded-full {sizes[
      size
    ]}"
    aria-hidden="true"
  ></div>
  {#if text}
    <span class="text-muted-foreground">{text}</span>
  {/if}
</div>
