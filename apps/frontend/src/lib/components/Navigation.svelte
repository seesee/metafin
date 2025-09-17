<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  interface NavItem {
    label: string;
    href: string;
    icon: string;
    description: string;
  }

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: '/',
      icon: '🏠',
      description: 'System overview and health status',
    },
    {
      label: 'Library',
      href: '/library',
      icon: '📚',
      description: 'Browse and manage your media library',
    },
    {
      label: 'Providers',
      href: '/providers',
      icon: '🔍',
      description: 'Search and match metadata from external providers',
    },
    {
      label: 'Collections',
      href: '/collections',
      icon: '📦',
      description: 'Manage custom and smart collections',
    },
    {
      label: 'Review Queue',
      href: '/review-queue',
      icon: '🔍',
      description: 'Review flagged items and misclassifications',
    },
    {
      label: 'Jobs',
      href: '/jobs',
      icon: '⚙️',
      description: 'Monitor background tasks and operations',
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: '⚙️',
      description: 'Configure application and provider settings',
    },
  ];

  $: currentPath = $page.url.pathname;

  function isActive(href: string): boolean {
    if (href === '/') {
      return currentPath === '/';
    }
    return currentPath.startsWith(href);
  }

  function handleThemeToggle() {
    // Theme toggle functionality - will be imported from layout
    if (typeof window !== 'undefined') {
      const win = window as typeof window & { toggleTheme?: () => void };
      if (win.toggleTheme) {
        win.toggleTheme();
      }
    }
  }
</script>

<nav
  class="bg-card border-r border-border w-64 min-h-screen p-4"
  aria-label="Main navigation"
>
  <!-- Logo -->
  <div class="mb-8">
    <h1
      class="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
    >
      metafin
    </h1>
    <p class="text-sm text-muted-foreground">Jellyfin Metadata Manager</p>
  </div>

  <!-- Navigation Items -->
  <ul class="space-y-2" role="list">
    {#each navItems as item}
      <li>
        <a
          href={item.href}
          class="group flex items-start gap-3 p-3 rounded-lg transition-all duration-200 hover:bg-accent/50 {isActive(
            item.href
          )
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:text-foreground'}"
          aria-current={isActive(item.href) ? 'page' : undefined}
          on:click={(e) => {
            e.preventDefault();
            goto(item.href);
          }}
        >
          <span class="text-xl flex-shrink-0" aria-hidden="true"
            >{item.icon}</span
          >
          <div class="min-w-0 flex-1">
            <div class="font-medium group-hover:text-foreground">
              {item.label}
            </div>
            <div
              class="text-xs text-muted-foreground group-hover:text-muted-foreground/80 mt-1"
            >
              {item.description}
            </div>
          </div>
        </a>
      </li>
    {/each}
  </ul>

  <!-- Theme Toggle -->
  <div class="mt-auto pt-8">
    <button
      type="button"
      class="w-full p-3 rounded-lg border border-border hover:bg-accent/50 transition-all duration-200 text-sm text-muted-foreground hover:text-foreground flex items-center gap-2"
      on:click={handleThemeToggle}
    >
      <span aria-hidden="true">🌓</span>
      Toggle Theme
    </button>
  </div>
</nav>

<style>
  /* Focus styles for accessibility */
  a:focus {
    @apply outline-none ring-2 ring-primary ring-offset-2 ring-offset-background;
  }

  button:focus {
    @apply outline-none ring-2 ring-primary ring-offset-2 ring-offset-background;
  }
</style>
