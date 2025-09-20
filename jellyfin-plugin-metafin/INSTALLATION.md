# Jellyfin Plugin Metafin - Installation Guide

This guide will help you install and configure the Metafin plugin for Jellyfin to enable reliable metadata synchronization.

## Prerequisites

- Jellyfin 10.10.7 or later
- .NET 8.0 SDK (for building the plugin) - see BUILD.md for installation instructions
- Metafin backend application

## Step 1: Build the Plugin

See `BUILD.md` for detailed compilation instructions. Quick summary:

### For x64 Systems (Intel/AMD)

```bash
cd jellyfin-plugin-metafin
dotnet build --configuration Release --runtime linux-x64
```

**Plugin location:** `bin/Release/net8.0/linux-x64/Jellyfin.Plugin.Metafin.dll`

### For ARM64 Systems (Raspberry Pi, Apple Silicon servers)

```bash
cd jellyfin-plugin-metafin
dotnet build --configuration Release --runtime linux-arm64
```

**Plugin location:** `bin/Release/net8.0/linux-arm64/Jellyfin.Plugin.Metafin.dll`

### For Universal Compatibility (Any CPU)

```bash
cd jellyfin-plugin-metafin
dotnet build --configuration Release
```

**Plugin location:** `bin/Release/net8.0/Jellyfin.Plugin.Metafin.dll`

## Step 2: Install the Plugin

1. **Find your Jellyfin plugins directory:**
   - **Docker**: Usually `/config/plugins/` inside the container
   - **Linux**: Usually `/var/lib/jellyfin/plugins/`
   - **Windows**: Usually `%ProgramData%\Jellyfin\Server\plugins\`
   - **macOS**: Usually `/Users/USERNAME/.local/share/jellyfin/plugins/`

2. **Create the plugin directory:**
   ```bash
   mkdir -p /path/to/jellyfin/plugins/Jellyfin.Plugin.Metafin_1.0.0.0
   ```

3. **Copy the plugin DLL (choose based on your build):**

   **For x64 build:**
   ```bash
   cp bin/Release/net8.0/linux-x64/Jellyfin.Plugin.Metafin.dll /path/to/jellyfin/plugins/Jellyfin.Plugin.Metafin_1.0.0.0/
   ```

   **For ARM64 build:**
   ```bash
   cp bin/Release/net8.0/linux-arm64/Jellyfin.Plugin.Metafin.dll /path/to/jellyfin/plugins/Jellyfin.Plugin.Metafin_1.0.0.0/
   ```

   **For universal build:**
   ```bash
   cp bin/Release/net8.0/Jellyfin.Plugin.Metafin.dll /path/to/jellyfin/plugins/Jellyfin.Plugin.Metafin_1.0.0.0/
   ```

## Step 3: Restart Jellyfin

Restart your Jellyfin server to load the new plugin:

```bash
# Docker
docker restart jellyfin

# Systemd (Linux)
sudo systemctl restart jellyfin

# Other systems - restart your Jellyfin service
```

## Step 4: Configure the Plugin

1. **Access Jellyfin Admin Dashboard:**
   - Open your Jellyfin web interface
   - Log in as an administrator
   - Go to Administration > Dashboard

2. **Navigate to Plugins:**
   - Click on "Plugins" in the left sidebar
   - You should see "Metafin" in the installed plugins list

3. **Configure the Plugin:**
   - Click on the "Metafin" plugin
   - Configure the settings:
     - **Enable Plugin**: Check this box
     - **Metafin Server URL**: Enter your Metafin server URL (e.g., `http://localhost:8080`)
     - **API Key**: Enter the same API key you use for Jellyfin API access

4. **Save Configuration:**
   - Click "Save" to apply the settings

## Step 5: Verify Installation

1. **Check Plugin Status:**
   Test that the plugin is working by accessing:
   ```
   http://your-jellyfin-server:8096/metafin/status
   ```

   You should receive a JSON response like:
   ```json
   {
     "PluginVersion": "1.0.0",
     "IsEnabled": true,
     "MetafinUrl": "http://localhost:8080",
     "Status": "Active"
   }
   ```

2. **Check Jellyfin Logs:**
   Look for log entries related to the Metafin plugin:
   ```bash
   # View recent logs
   tail -f /path/to/jellyfin/logs/jellyfin.log | grep -i metafin
   ```

## Step 6: Test Metadata Sync

1. **Make a metadata change in Metafin:**
   - Open Metafin frontend
   - Edit metadata for any item
   - Save the changes

2. **Check Jellyfin logs:**
   You should see log entries indicating successful metadata updates via the plugin:
   ```
   [INF] Received metadata update request for item [ItemId]
   [INF] Successfully updated metadata for item [ItemId]
   ```

3. **Verify changes in Jellyfin:**
   - Check the item in Jellyfin's web interface
   - The metadata changes should be reflected

## Docker Installation

If you're running Jellyfin in Docker, the process is slightly different:

### 1. Build the Plugin

Choose the appropriate architecture for your Docker host:

**For x64 hosts:**
```bash
cd jellyfin-plugin-metafin
dotnet build --configuration Release --runtime linux-x64
```

**For ARM64 hosts (like Raspberry Pi):**
```bash
cd jellyfin-plugin-metafin
dotnet build --configuration Release --runtime linux-arm64
```

### 2. Copy to Docker Volume

**Method 1: Copy directly to host volume:**
```bash
# Find your Jellyfin config directory (usually mapped to /config in container)
JELLYFIN_CONFIG_PATH="/path/to/your/jellyfin/config"

# Create plugin directory
mkdir -p "$JELLYFIN_CONFIG_PATH/plugins/Jellyfin.Plugin.Metafin_1.0.0.0"

# Copy plugin (adjust path based on your build)
cp bin/Release/net8.0/linux-x64/Jellyfin.Plugin.Metafin.dll "$JELLYFIN_CONFIG_PATH/plugins/Jellyfin.Plugin.Metafin_1.0.0.0/"
```

**Method 2: Copy into running container:**
```bash
# Copy plugin into container
docker cp bin/Release/net8.0/linux-x64/Jellyfin.Plugin.Metafin.dll jellyfin:/config/plugins/Jellyfin.Plugin.Metafin_1.0.0.0/

# Restart container
docker restart jellyfin
```

### 3. Verify Installation

Check the container logs to ensure the plugin loaded:
```bash
docker logs jellyfin | grep -i metafin
```

## Troubleshooting

### Plugin Not Loading

- Ensure .NET 8.0 is installed on your Jellyfin server
- Check that the plugin DLL is in the correct directory
- Verify file permissions allow Jellyfin to read the plugin
- Check Jellyfin logs for plugin loading errors

### API Key Issues

- Ensure the API key in the plugin configuration matches your Jellyfin API key
- For development, you can leave the API key empty (not recommended for production)

### Connection Issues

- Verify Metafin can reach Jellyfin on the network
- Check firewall settings
- Ensure Jellyfin is listening on the expected port

### Metadata Updates Not Working

- Check that the plugin status returns "Active"
- Verify API key authentication
- Look for error messages in Jellyfin logs
- Ensure the item ID being updated exists in Jellyfin

## Security Considerations

- Use a strong API key in production environments
- Consider running Jellyfin and Metafin on the same network
- Monitor plugin activity through logs
- Regularly update the plugin when new versions are available

## Uninstalling

To remove the plugin:

1. Delete the plugin directory:
   ```bash
   rm -rf /path/to/jellyfin/plugins/Jellyfin.Plugin.Metafin_1.0.0.0
   ```

2. Restart Jellyfin

## Support

If you encounter issues:

1. Check the Jellyfin logs for error messages
2. Verify all installation steps were followed correctly
3. Ensure Jellyfin version compatibility
4. Test with a simple metadata update first