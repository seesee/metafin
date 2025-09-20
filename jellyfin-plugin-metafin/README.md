# Jellyfin Plugin Metafin

A Jellyfin plugin that enables reliable metadata updates from the Metafin application.

## Overview

This plugin provides a secure HTTP API endpoint within Jellyfin that allows the Metafin application to update item metadata directly within Jellyfin's internal systems, bypassing the limitations of Jellyfin's standard REST API for metadata updates.

## Features

- **Reliable Metadata Updates**: Direct access to Jellyfin's internal metadata system
- **Comprehensive Support**: Updates names, overviews, dates, genres, tags, studios, and provider IDs
- **API Key Authentication**: Secure communication between Metafin and Jellyfin
- **Background Refresh**: Optional automatic metadata refresh after updates
- **Extensive Logging**: Detailed logging for troubleshooting and monitoring

## API Endpoints

### `POST /metafin/items/{itemId}/metadata`

Updates metadata for a specific Jellyfin item.

**Request Body:**
```json
{
  "apiKey": "your-api-key",
  "name": "Updated Title",
  "overview": "Updated description",
  "productionYear": 2023,
  "genres": ["Drama", "Action"],
  "tags": ["Custom Tag"],
  "studios": ["Studio Name"],
  "officialRating": "PG-13",
  "communityRating": 8.5,
  "premiereDate": "2023-01-01T00:00:00Z",
  "endDate": "2023-12-31T00:00:00Z",
  "providerIds": {
    "tvdb": "123456",
    "imdb": "tt1234567"
  },
  "refreshAfterUpdate": true
}
```

### `GET /metafin/status`

Returns the current status of the plugin.

## Installation

1. Build the plugin:
   ```bash
   cd jellyfin-plugin-metafin
   dotnet build --configuration Release
   ```

2. Copy the built DLL to your Jellyfin plugins directory:
   ```bash
   cp bin/Release/net8.0/Jellyfin.Plugin.Metafin.dll /path/to/jellyfin/plugins/
   ```

3. Restart Jellyfin

4. Configure the plugin in Jellyfin Admin Dashboard > Plugins > Metafin

## Configuration

- **Enable Plugin**: Toggle to enable/disable the plugin
- **Metafin Server URL**: The URL where your Metafin instance is running
- **API Key**: Secret key for authentication (leave empty for development)

## Security

- API key authentication protects against unauthorized access
- All metadata updates are logged for audit purposes
- Plugin respects Jellyfin's internal security model

## Development

This plugin is designed to work with:
- Jellyfin 10.10.7+
- .NET 8.0
- Metafin backend application

## Troubleshooting

Check Jellyfin logs for plugin activity:
- Plugin loading: Look for "Metafin" plugin initialization
- API requests: Look for "MetadataController" log entries
- Errors: Check for stack traces and error messages

## License

This plugin is designed specifically for the Metafin project and follows the same licensing terms.