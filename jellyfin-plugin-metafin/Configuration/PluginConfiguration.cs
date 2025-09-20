using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.Metafin.Configuration
{
    /// <summary>
    /// Plugin configuration.
    /// </summary>
    public class PluginConfiguration : BasePluginConfiguration
    {
        /// <summary>
        /// Gets or sets the API key for authentication with Metafin.
        /// </summary>
        public string ApiKey { get; set; } = string.Empty;

        /// <summary>
        /// Gets or sets a value indicating whether the plugin is enabled.
        /// </summary>
        public bool IsEnabled { get; set; } = true;

        /// <summary>
        /// Gets or sets the Metafin server URL.
        /// </summary>
        public string MetafinUrl { get; set; } = "http://localhost:8080";
    }
}