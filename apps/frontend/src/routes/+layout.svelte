<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import Navigation from '$lib/components/Navigation.svelte';
  import ErrorDisplay from '$lib/components/ErrorDisplay.svelte';
  import SystemStatus from '$lib/components/SystemStatus.svelte';

  // Theme management
  let theme = 'light';
  let highContrast = false;

  // Global error handling
  let globalError: Error | null = null;
  let showSystemStatus = false;

  // Mobile navigation state
  let isMobileMenuOpen = false;
  let isMobile = false;

  // Global error handler for unhandled JavaScript errors
  function handleGlobalError(event: ErrorEvent) {
    console.error('Global error caught:', event.error);
    globalError = event.error || new Error(event.message);
  }

  // Global handler for unhandled promise rejections
  function handleUnhandledRejection(event: PromiseRejectionEvent) {
    console.error('Unhandled promise rejection:', event.reason);
    globalError =
      event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));
  }

  function clearGlobalError() {
    globalError = null;
  }

  onMount(() => {
    if (browser) {
      // Load theme from localStorage
      theme = localStorage.getItem('theme') || 'light';
      highContrast = localStorage.getItem('highContrast') === 'true';
      applyTheme();

      // Check if device is mobile
      checkIfMobile();

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

      // Listen for resize events to update mobile state
      const resizeQuery = window.matchMedia('(max-width: 768px)');
      resizeQuery.addEventListener('change', handleResize);

      // Set up global error handlers
      window.addEventListener('error', handleGlobalError);
      window.addEventListener('unhandledrejection', handleUnhandledRejection);

      return () => {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
        resizeQuery.removeEventListener('change', handleResize);
        window.removeEventListener('error', handleGlobalError);
        window.removeEventListener(
          'unhandledrejection',
          handleUnhandledRejection
        );
      };
    }
  });

  function handleSystemThemeChange(_e: MediaQueryListEvent) {
    if (theme === 'system') {
      applyTheme();
    }
  }

  function checkIfMobile() {
    if (!browser) return;
    isMobile = window.matchMedia('(max-width: 768px)').matches;
    // Close mobile menu when switching to desktop
    if (!isMobile) {
      isMobileMenuOpen = false;
    }
  }

  function handleResize(e: MediaQueryListEvent) {
    isMobile = e.matches;
    // Close mobile menu when switching to desktop
    if (!isMobile) {
      isMobileMenuOpen = false;
    }
  }

  function toggleMobileMenu() {
    isMobileMenuOpen = !isMobileMenuOpen;
  }

  function closeMobileMenu() {
    isMobileMenuOpen = false;
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

<!-- Global Error Display -->
{#if globalError}
  <div class="fixed top-0 left-0 right-0 z-50 p-4">
    <ErrorDisplay
      error={globalError}
      title="Critical Application Error"
      context="Global Error Handler"
      variant="critical"
      showDetails={true}
      showStack={true}
      onDismiss={clearGlobalError}
      persistent={false}
    />
  </div>
{/if}

<!-- System Status Panel (collapsible) -->
{#if showSystemStatus}
  <div class="fixed bottom-4 right-4 z-40 max-w-md">
    <div class="relative">
      <button
        type="button"
        class="absolute top-2 right-2 z-10 text-muted-foreground hover:text-foreground"
        on:click={() => (showSystemStatus = false)}
        title="Close system status"
      >
        ✕
      </button>
      <SystemStatus autoRefresh={true} refreshInterval={30000} />
    </div>
  </div>
{/if}

<!-- System Status Toggle Button -->
<button
  type="button"
  class="fixed bottom-4 left-4 z-40 p-2 bg-card border border-border rounded-full shadow-lg hover:shadow-xl transition-all"
  on:click={() => (showSystemStatus = !showSystemStatus)}
  title={showSystemStatus ? 'Hide system status' : 'Show system status'}
>
  <div class="w-6 h-6 flex items-center justify-center">
    {showSystemStatus ? '📊' : '🔍'}
  </div>
</button>

{#if showNavigation}
  <div class="flex min-h-screen relative">
    <!-- Mobile Menu Toggle Button -->
    {#if isMobile}
      <button
        type="button"
        class="fixed top-4 left-4 z-50 p-2 bg-card border border-border rounded-lg shadow-lg hover:shadow-xl transition-all md:hidden"
        on:click={toggleMobileMenu}
        aria-label={isMobileMenuOpen
          ? 'Close navigation menu'
          : 'Open navigation menu'}
        aria-expanded={isMobileMenuOpen}
      >
        <div class="w-6 h-6 flex items-center justify-center">
          {#if isMobileMenuOpen}
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          {:else}
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16"
              ></path>
            </svg>
          {/if}
        </div>
      </button>
    {/if}

    <!-- Mobile Menu Overlay -->
    {#if isMobile && isMobileMenuOpen}
      <div
        class="fixed inset-0 bg-black/50 z-40 md:hidden"
        on:click={closeMobileMenu}
        on:keydown={(e) => e.key === 'Escape' && closeMobileMenu()}
        role="button"
        tabindex="-1"
        aria-label="Close navigation menu"
      ></div>
    {/if}

    <!-- Navigation Sidebar -->
    <div
      class="
      {isMobile
        ? isMobileMenuOpen
          ? 'fixed inset-y-0 left-0 z-50 transform translate-x-0'
          : 'fixed inset-y-0 left-0 z-50 transform -translate-x-full'
        : 'relative'}
      transition-transform duration-300 ease-in-out md:translate-x-0
    "
    >
      <Navigation {isMobile} {closeMobileMenu} />
    </div>

    <!-- Main Content -->
    <main class="flex-1 overflow-auto {isMobile ? 'w-full' : ''}">
      <div class={isMobile ? 'pt-16 px-4' : 'p-0'}>
        <slot />
      </div>
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
