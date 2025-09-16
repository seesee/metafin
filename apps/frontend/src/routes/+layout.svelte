<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  // Theme management
  let theme = 'light';
  let highContrast = false;

  onMount(() => {
    if (browser) {
      // Load theme from localStorage
      theme = localStorage.getItem('theme') || 'light';
      highContrast = localStorage.getItem('highContrast') === 'true';
      applyTheme();

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
</script>

<main class="min-h-screen">
  <slot />
</main>

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
