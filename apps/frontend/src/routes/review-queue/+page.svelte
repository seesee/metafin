<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient, ApiError } from '$lib/api/client.js';

  interface ReviewQueueItem {
    id: string;
    jellyfinId: string;
    name: string;
    type: string;
    library: { name: string };
    path?: string;
    misclassificationScore?: number;
    misclassificationReasons?: string;
    priority: 'low' | 'medium' | 'high';
    addedAt: string;
    reviewedAt?: string;
    reviewedBy?: string;
    status: 'pending' | 'reviewed' | 'dismissed';
  }

  interface ReviewQueueStats {
    totalItems: number;
    pendingItems: number;
    highPriorityItems: number;
    mediumPriorityItems: number;
    lowPriorityItems: number;
    averageScore: number;
    oldestItemAge: number;
  }

  let items: ReviewQueueItem[] = [];
  let stats: ReviewQueueStats | null = null;
  let loading = true;
  let error: string | null = null;
  let selectedItems: Set<string> = new Set();

  // Filters
  let statusFilter: 'pending' | 'reviewed' | 'dismissed' | '' = 'pending';
  let priorityFilter: 'low' | 'medium' | 'high' | '' = '';
  let sortBy: 'score' | 'addedAt' | 'priority' = 'score';
  let sortOrder: 'asc' | 'desc' = 'desc';

  // Pagination
  let currentPage = 1;
  let itemsPerPage = 25;
  let totalItems = 0;

  onMount(() => {
    loadData();
  });

  async function loadData() {
    loading = true;
    error = null;

    try {
      const [queueData, statsData] = await Promise.all([
        apiClient.getReviewQueue({
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
          limit: itemsPerPage,
          offset: (currentPage - 1) * itemsPerPage,
          sortBy,
          sortOrder,
        }),
        apiClient.getReviewQueueStats(),
      ]);

      items = queueData.items;
      totalItems = queueData.pagination.total;
      stats = statsData;
    } catch (err) {
      if (err instanceof ApiError) {
        error = `${err.code}: ${err.message}`;
      } else {
        error = 'Failed to load review queue data';
      }
    } finally {
      loading = false;
    }
  }

  function handleFilterChange() {
    currentPage = 1;
    selectedItems.clear();
    selectedItems = selectedItems;
    loadData();
  }

  function handlePageChange(page: number) {
    currentPage = page;
    selectedItems.clear();
    selectedItems = selectedItems;
    loadData();
  }

  function toggleSelectAll() {
    if (selectedItems.size === items.length) {
      selectedItems.clear();
    } else {
      selectedItems = new Set(items.map((item) => item.id));
    }
    selectedItems = selectedItems;
  }

  function toggleSelectItem(itemId: string) {
    if (selectedItems.has(itemId)) {
      selectedItems.delete(itemId);
    } else {
      selectedItems.add(itemId);
    }
    selectedItems = selectedItems;
  }

  async function reviewItem(
    itemId: string,
    action: 'dismiss' | 'correct_type' | 'update_metadata' | 'flag_for_manual',
    options: {
      newType?: string;
      metadata?: Record<string, unknown>;
      notes?: string;
    } = {}
  ) {
    try {
      await apiClient.reviewItem(itemId, { action, ...options }, 'User');
      // Reload data to reflect changes
      await loadData();
    } catch (err) {
      if (err instanceof ApiError) {
        error = `Failed to review item: ${err.message}`;
      } else {
        error = 'Failed to review item';
      }
    }
  }

  async function bulkReview(
    action: 'dismiss' | 'correct_type' | 'update_metadata' | 'flag_for_manual'
  ) {
    if (selectedItems.size === 0) return;

    try {
      const result = await apiClient.bulkReviewItems(
        Array.from(selectedItems),
        { action },
        'User'
      );

      if (result.failed > 0) {
        error = `Bulk review completed with ${result.failed} failures`;
      }

      selectedItems.clear();
      selectedItems = selectedItems;
      await loadData();
    } catch (err) {
      if (err instanceof ApiError) {
        error = `Bulk review failed: ${err.message}`;
      } else {
        error = 'Bulk review failed';
      }
    }
  }

  function getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatScore(score: number): string {
    return (score * 100).toFixed(1) + '%';
  }

  $: totalPages = Math.ceil(totalItems / itemsPerPage);
</script>

<svelte:head>
  <title>Review Queue - metafin</title>
</svelte:head>

<div class="container mx-auto px-6 py-8 max-w-7xl">
  <header class="mb-8">
    <h1 class="text-3xl font-bold mb-2">Review Queue</h1>
    <p class="text-muted-foreground">
      Review flagged items and potential misclassifications
    </p>
  </header>

  <!-- Stats Cards -->
  {#if stats}
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-8">
      <div class="rounded-lg border bg-card p-4">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-blue-500"></span>
          <h3 class="font-medium">Total Items</h3>
        </div>
        <p class="text-2xl font-bold">{stats.totalItems}</p>
      </div>

      <div class="rounded-lg border bg-card p-4">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-orange-500"></span>
          <h3 class="font-medium">Pending</h3>
        </div>
        <p class="text-2xl font-bold">{stats.pendingItems}</p>
      </div>

      <div class="rounded-lg border bg-card p-4">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-red-500"></span>
          <h3 class="font-medium">High Priority</h3>
        </div>
        <p class="text-2xl font-bold">{stats.highPriorityItems}</p>
      </div>

      <div class="rounded-lg border bg-card p-4">
        <h3 class="font-medium">Average Score</h3>
        <p class="text-2xl font-bold">{formatScore(stats.averageScore)}</p>
      </div>

      <div class="rounded-lg border bg-card p-4">
        <h3 class="font-medium">Oldest Item</h3>
        <p class="text-2xl font-bold">{stats.oldestItemAge}d</p>
      </div>
    </div>
  {/if}

  <!-- Filters and Actions -->
  <div class="rounded-lg border bg-card p-6 mb-6">
    <div class="flex flex-col lg:flex-row gap-4 justify-between">
      <!-- Filters -->
      <div class="flex flex-wrap gap-4">
        <div>
          <label for="status-filter" class="block text-sm font-medium mb-1"
            >Status</label
          >
          <select
            id="status-filter"
            bind:value={statusFilter}
            on:change={handleFilterChange}
            class="px-3 py-2 border border-border rounded-md bg-background"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>

        <div>
          <label for="priority-filter" class="block text-sm font-medium mb-1"
            >Priority</label
          >
          <select
            id="priority-filter"
            bind:value={priorityFilter}
            on:change={handleFilterChange}
            class="px-3 py-2 border border-border rounded-md bg-background"
          >
            <option value="">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div>
          <label for="sort-by" class="block text-sm font-medium mb-1"
            >Sort By</label
          >
          <select
            id="sort-by"
            bind:value={sortBy}
            on:change={handleFilterChange}
            class="px-3 py-2 border border-border rounded-md bg-background"
          >
            <option value="score">Score</option>
            <option value="addedAt">Date Added</option>
            <option value="priority">Priority</option>
          </select>
        </div>

        <div>
          <label for="sort-order" class="block text-sm font-medium mb-1"
            >Order</label
          >
          <select
            id="sort-order"
            bind:value={sortOrder}
            on:change={handleFilterChange}
            class="px-3 py-2 border border-border rounded-md bg-background"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      <!-- Bulk Actions -->
      {#if selectedItems.size > 0}
        <div class="flex gap-2">
          <button
            type="button"
            class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            on:click={() => bulkReview('dismiss')}
          >
            Dismiss ({selectedItems.size})
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
            on:click={() => bulkReview('flag_for_manual')}
          >
            Flag for Manual Review ({selectedItems.size})
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Error Message -->
  {#if error}
    <div
      class="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6"
    >
      <p class="text-destructive">{error}</p>
    </div>
  {/if}

  <!-- Loading State -->
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div
        class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
      ></div>
      <span class="ml-2 text-muted-foreground">Loading review queue...</span>
    </div>
  {:else if items.length === 0}
    <div class="text-center py-12">
      <p class="text-muted-foreground">No items in the review queue</p>
    </div>
  {:else}
    <!-- Items Table -->
    <div class="rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="border-b bg-muted/30">
            <tr>
              <th class="p-4 text-left">
                <input
                  type="checkbox"
                  checked={selectedItems.size === items.length &&
                    items.length > 0}
                  on:change={toggleSelectAll}
                  class="rounded"
                />
              </th>
              <th class="p-4 text-left font-medium">Item</th>
              <th class="p-4 text-left font-medium">Priority</th>
              <th class="p-4 text-left font-medium">Score</th>
              <th class="p-4 text-left font-medium">Added</th>
              <th class="p-4 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each items as item (item.id)}
              <tr class="border-b hover:bg-muted/30 transition-colors">
                <td class="p-4">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    on:change={() => toggleSelectItem(item.id)}
                    class="rounded"
                  />
                </td>
                <td class="p-4">
                  <div>
                    <h4 class="font-medium">{item.name}</h4>
                    <div class="text-sm text-muted-foreground space-y-1">
                      <p>Type: {item.type} • Library: {item.library.name}</p>
                      {#if item.path}
                        <p class="font-mono text-xs truncate">{item.path}</p>
                      {/if}
                      {#if item.misclassificationReasons}
                        <div class="mt-2">
                          {#each JSON.parse(item.misclassificationReasons) as reason}
                            <span
                              class="inline-block bg-muted px-2 py-1 rounded text-xs mr-1 mb-1"
                            >
                              {reason.description}
                            </span>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  </div>
                </td>
                <td class="p-4">
                  <span class="inline-flex items-center gap-2">
                    <span
                      class="w-2 h-2 rounded-full {getPriorityColor(
                        item.priority
                      )}"
                    ></span>
                    <span class="capitalize">{item.priority}</span>
                  </span>
                </td>
                <td class="p-4">
                  {#if item.misclassificationScore}
                    <span class="font-mono"
                      >{formatScore(item.misclassificationScore)}</span
                    >
                  {:else}
                    <span class="text-muted-foreground">N/A</span>
                  {/if}
                </td>
                <td class="p-4">
                  <span class="text-sm">{formatDate(item.addedAt)}</span>
                </td>
                <td class="p-4">
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                      on:click={() => reviewItem(item.id, 'dismiss')}
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      class="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 transition-colors"
                      on:click={() => reviewItem(item.id, 'flag_for_manual')}
                    >
                      Manual Review
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      {#if totalPages > 1}
        <div class="flex items-center justify-between p-4 border-t">
          <div class="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(
              currentPage * itemsPerPage,
              totalItems
            )} of {totalItems} items
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              class="px-3 py-1 border border-border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
              on:click={() => handlePageChange(currentPage - 1)}
            >
              Previous
            </button>

            {#each Array(Math.min(5, totalPages))
              .fill(0)
              .map((_, i) => {
                const startPage = Math.max(1, currentPage - 2);
                return Math.min(startPage + i, totalPages);
              }) as page}
              <button
                type="button"
                class="px-3 py-1 border border-border rounded {currentPage ===
                page
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'} transition-colors"
                on:click={() => handlePageChange(page)}
              >
                {page}
              </button>
            {/each}

            <button
              type="button"
              disabled={currentPage === totalPages}
              class="px-3 py-1 border border-border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
              on:click={() => handlePageChange(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
