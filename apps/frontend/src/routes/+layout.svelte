<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import Navigation from '$lib/components/Navigation.svelte';

  // Theme management
  let theme = 'light';
  let highContrast = false;

  onMount(() => {
    if (browser) {
      // Load theme from localStorage
      theme = localStorage.getItem('theme') || 'light';
      highContrast = localStorage.getItem('highContrast') === 'true';
      applyTheme();

      // Make theme functions available globally for Navigation component
      const win = window as typeof window & {
        toggleTheme?: () => void;
        toggleHighContrast?: () => void;
      };
      win.toggleTheme = toggleTheme;
      win.toggleHighContrast = toggleHighContrast;

      // Listen for system theme changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', handleSystemThemeChange);

      return () => {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
      };
    }
  });

  function handleSystemThemeChange(_e: MediaQueryListEvent) {
    if (theme === 'system') {
      applyTheme();
    }
  }

  function applyTheme() {
    if (!browser) return;

    const root = document.documentElement;
    root.classList.remove('light', 'dark', 'high-contrast');

    if (highContrast) {
      root.classList.add('high-contrast');
    }

    if (theme === 'system') {
      const prefersDark = window.matchMedia(
        '(prefers-color-scheme: dark)'
      ).matches;
      root.classList.add(prefersDark ? 'dark' : 'light');
    } else {
      root.classList.add(theme);
    }
  }

  export function toggleTheme() {
    if (theme === 'light') {
      theme = 'dark';
    } else if (theme === 'dark') {
      theme = 'system';
    } else {
      theme = 'light';
    }

    if (browser) {
      localStorage.setItem('theme', theme);
      applyTheme();
    }
  }

  export function toggleHighContrast() {
    highContrast = !highContrast;
    if (browser) {
      localStorage.setItem('highContrast', String(highContrast));
      applyTheme();
    }
  }

  // Determine if we should show navigation (hide on certain routes if needed)
  $: showNavigation = true; // For now, always show navigation
</script>

{#if showNavigation}
  <div class="flex min-h-screen">
    <Navigation />
    <main class="flex-1 overflow-auto">
      <slot />
    </main>
  </div>
{:else}
  <main class="min-h-screen">
    <slot />
  </main>
{/if}

<style>
  :global(html) {
    scroll-behavior: smooth;
  }

  @media (prefers-reduced-motion: reduce) {
    :global(html) {
      scroll-behavior: auto;
    }
  }
</style>
