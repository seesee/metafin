using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Jellyfin.Plugin.Metafin.Configuration;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Providers;
using MediaBrowser.Model.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Metafin.Api
{
    /// <summary>
    /// Metadata update controller.
    /// </summary>
    [ApiController]
    [Route("metafin")]
    [Produces("application/json")]
    public class MetadataController : ControllerBase
    {
        private readonly ILibraryManager _libraryManager;
        private readonly IProviderManager _providerManager;
        private readonly ILogger<MetadataController> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="MetadataController"/> class.
        /// </summary>
        /// <param name="libraryManager">Instance of the <see cref="ILibraryManager"/> interface.</param>
        /// <param name="providerManager">Instance of the <see cref="IProviderManager"/> interface.</param>
        /// <param name="logger">Instance of the <see cref="ILogger{MetadataController}"/> interface.</param>
        public MetadataController(
            ILibraryManager libraryManager,
            IProviderManager providerManager,
            ILogger<MetadataController> logger)
        {
            _libraryManager = libraryManager;
            _providerManager = providerManager;
            _logger = logger;
        }

        /// <summary>
        /// Updates metadata for a specific item.
        /// </summary>
        /// <param name="itemId">The ID of the item to update.</param>
        /// <param name="updateRequest">The metadata update request.</param>
        /// <returns>Success status.</returns>
        [HttpPost("items/{itemId}/metadata")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<ActionResult> UpdateMetadata(
            [FromRoute, Required] string itemId,
            [FromBody, Required] MetadataUpdateRequest updateRequest)
        {
            try
            {
                _logger.LogInformation("Received metadata update request for item {ItemId}", itemId);

                // Validate API key
                if (!ValidateApiKey(updateRequest.ApiKey))
                {
                    _logger.LogWarning("Invalid API key provided for metadata update");
                    return Unauthorized("Invalid API key");
                }

                // Find the item by ID
                var item = _libraryManager.GetItemById(new Guid(itemId));
                if (item == null)
                {
                    _logger.LogWarning("Item not found: {ItemId}", itemId);
                    return NotFound($"Item with ID {itemId} not found");
                }

                _logger.LogInformation("Found item: {ItemName} ({ItemType})", item.Name, item.GetType().Name);

                // Apply metadata updates
                var hasChanges = ApplyMetadataUpdates(item, updateRequest);

                if (hasChanges)
                {
                    // Save changes to database
                    await _libraryManager.UpdateItemAsync(
                        item,
                        item.GetParent(),
                        ItemUpdateType.MetadataEdit,
                        CancellationToken.None);

                    _logger.LogInformation("Successfully updated metadata for item {ItemId}", itemId);

                    // Optionally refresh metadata to ensure consistency
                    if (updateRequest.RefreshAfterUpdate ?? true)
                    {
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                // Simple refresh - just save the item again to trigger any necessary updates
                                await _libraryManager.UpdateItemAsync(
                                    item,
                                    item.GetParent(),
                                    ItemUpdateType.MetadataEdit,
                                    CancellationToken.None);

                                _logger.LogInformation("Completed metadata refresh for item {ItemId}", itemId);
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, "Error during background metadata refresh for item {ItemId}", itemId);
                            }
                        });
                    }

                    return Ok(new { Success = true, Message = "Metadata updated successfully" });
                }
                else
                {
                    _logger.LogInformation("No changes applied to item {ItemId}", itemId);
                    return Ok(new { Success = true, Message = "No changes to apply" });
                }
            }
            catch (ArgumentException ex)
            {
                _logger.LogError(ex, "Invalid argument in metadata update request for item {ItemId}", itemId);
                return BadRequest($"Invalid request: {ex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating metadata for item {ItemId}", itemId);
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets the current status of the plugin.
        /// </summary>
        /// <returns>Plugin status information.</returns>
        [HttpGet("status")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        public ActionResult GetStatus()
        {
            var config = Plugin.Instance?.Configuration ?? new PluginConfiguration();
            return Ok(new
            {
                PluginVersion = "1.0.0",
                IsEnabled = config.IsEnabled,
                MetafinUrl = config.MetafinUrl,
                Status = "Active"
            });
        }

        private bool ValidateApiKey(string? providedApiKey)
        {
            var config = Plugin.Instance?.Configuration ?? new PluginConfiguration();

            // If no API key is configured, allow all requests (for development)
            if (string.IsNullOrEmpty(config.ApiKey))
            {
                _logger.LogWarning("No API key configured, allowing request");
                return true;
            }

            return !string.IsNullOrEmpty(providedApiKey) &&
                   string.Equals(providedApiKey, config.ApiKey, StringComparison.Ordinal);
        }

        private bool ApplyMetadataUpdates(BaseItem item, MetadataUpdateRequest request)
        {
            var hasChanges = false;

            // Update basic properties
            if (!string.IsNullOrEmpty(request.Name) && item.Name != request.Name)
            {
                item.Name = request.Name;
                hasChanges = true;
                _logger.LogDebug("Updated name: {Name}", request.Name);
            }

            if (!string.IsNullOrEmpty(request.Overview) && item.Overview != request.Overview)
            {
                item.Overview = request.Overview;
                hasChanges = true;
                _logger.LogDebug("Updated overview");
            }

            if (request.ProductionYear.HasValue && item.ProductionYear != request.ProductionYear.Value)
            {
                item.ProductionYear = request.ProductionYear.Value;
                hasChanges = true;
                _logger.LogDebug("Updated production year: {Year}", request.ProductionYear.Value);
            }

            if (!string.IsNullOrEmpty(request.OfficialRating) && item.OfficialRating != request.OfficialRating)
            {
                item.OfficialRating = request.OfficialRating;
                hasChanges = true;
                _logger.LogDebug("Updated official rating: {Rating}", request.OfficialRating);
            }

            if (request.CommunityRating.HasValue && item.CommunityRating != request.CommunityRating.Value)
            {
                item.CommunityRating = (float)request.CommunityRating.Value;
                hasChanges = true;
                _logger.LogDebug("Updated community rating: {Rating}", request.CommunityRating.Value);
            }

            // Update date fields
            if (request.PremiereDate.HasValue)
            {
                var premiereDate = request.PremiereDate.Value;
                if (item.PremiereDate != premiereDate)
                {
                    item.PremiereDate = premiereDate;
                    hasChanges = true;
                    _logger.LogDebug("Updated premiere date: {Date}", premiereDate);
                }
            }

            if (request.EndDate.HasValue)
            {
                var endDate = request.EndDate.Value;
                if (item.EndDate != endDate)
                {
                    item.EndDate = endDate;
                    hasChanges = true;
                    _logger.LogDebug("Updated end date: {Date}", endDate);
                }
            }

            // Update arrays (genres, tags, studios)
            if (request.Genres != null && !request.Genres.SequenceEqual(item.Genres))
            {
                item.Genres = request.Genres.ToArray();
                hasChanges = true;
                _logger.LogDebug("Updated genres: {Genres}", string.Join(", ", request.Genres));
            }

            if (request.Tags != null && !request.Tags.SequenceEqual(item.Tags))
            {
                item.Tags = request.Tags.ToArray();
                hasChanges = true;
                _logger.LogDebug("Updated tags: {Tags}", string.Join(", ", request.Tags));
            }

            if (request.Studios != null)
            {
                var currentStudios = item.Studios.ToList();
                if (!request.Studios.SequenceEqual(currentStudios))
                {
                    item.Studios = request.Studios.ToArray();
                    hasChanges = true;
                    _logger.LogDebug("Updated studios: {Studios}", string.Join(", ", request.Studios));
                }
            }

            // Update provider IDs
            if (request.ProviderIds != null && request.ProviderIds.Count > 0)
            {
                foreach (var providerId in request.ProviderIds)
                {
                    if (!item.ProviderIds.TryGetValue(providerId.Key, out var currentValue) ||
                        currentValue != providerId.Value)
                    {
                        item.ProviderIds[providerId.Key] = providerId.Value;
                        hasChanges = true;
                        _logger.LogDebug("Updated provider ID {Provider}: {Id}", providerId.Key, providerId.Value);
                    }
                }
            }

            return hasChanges;
        }
    }

    /// <summary>
    /// Metadata update request model.
    /// </summary>
    public class MetadataUpdateRequest
    {
        /// <summary>
        /// Gets or sets the API key for authentication.
        /// </summary>
        public string? ApiKey { get; set; }

        /// <summary>
        /// Gets or sets the item name.
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// Gets or sets the item overview.
        /// </summary>
        public string? Overview { get; set; }

        /// <summary>
        /// Gets or sets the production year.
        /// </summary>
        public int? ProductionYear { get; set; }

        /// <summary>
        /// Gets or sets the official rating.
        /// </summary>
        public string? OfficialRating { get; set; }

        /// <summary>
        /// Gets or sets the community rating.
        /// </summary>
        public double? CommunityRating { get; set; }

        /// <summary>
        /// Gets or sets the premiere date.
        /// </summary>
        public DateTime? PremiereDate { get; set; }

        /// <summary>
        /// Gets or sets the end date.
        /// </summary>
        public DateTime? EndDate { get; set; }

        /// <summary>
        /// Gets or sets the genres.
        /// </summary>
        public string[]? Genres { get; set; }

        /// <summary>
        /// Gets or sets the tags.
        /// </summary>
        public string[]? Tags { get; set; }

        /// <summary>
        /// Gets or sets the studios.
        /// </summary>
        public string[]? Studios { get; set; }

        /// <summary>
        /// Gets or sets the provider IDs.
        /// </summary>
        public Dictionary<string, string>? ProviderIds { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether to refresh metadata after update.
        /// </summary>
        public bool? RefreshAfterUpdate { get; set; }
    }
}