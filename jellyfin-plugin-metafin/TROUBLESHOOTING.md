# Jellyfin Plugin Metafin - Troubleshooting Guide

## Plugin Installation Issues

### Permission Denied Error

If you get an error like:
```
System.UnauthorizedAccessException: Access to the path '/var/lib/jellyfin/plugins/Jellyfin.Plugin.Metafin_1.0.0.0/meta.json' is denied.
```

This is a file permissions issue. Here are the solutions:

#### For Docker Installations

**Method 1: Fix permissions on host directory**
```bash
# Find your Jellyfin config directory (usually mapped to /config in container)
JELLYFIN_CONFIG_PATH="/path/to/your/jellyfin/config"

# Create plugins directory with correct permissions
sudo mkdir -p "$JELLYFIN_CONFIG_PATH/plugins"
sudo chown -R 1000:1000 "$JELLYFIN_CONFIG_PATH/plugins"
sudo chmod -R 755 "$JELLYFIN_CONFIG_PATH/plugins"

# Install plugin
mkdir -p "$JELLYFIN_CONFIG_PATH/plugins/Jellyfin.Plugin.Metafin_1.0.0.0"
cp bin/Release/net8.0/Jellyfin.Plugin.Metafin.dll "$JELLYFIN_CONFIG_PATH/plugins/Jellyfin.Plugin.Metafin_1.0.0.0/"

# Fix permissions again
sudo chown -R 1000:1000 "$JELLYFIN_CONFIG_PATH/plugins"
```

**Method 2: Install via Docker exec**
```bash
# Copy plugin into running container with correct user
docker cp bin/Release/net8.0/Jellyfin.Plugin.Metafin.dll jellyfin:/config/plugins/Jellyfin.Plugin.Metafin_1.0.0.0/

# Fix permissions inside container
docker exec --user root jellyfin chown -R jellyfin:jellyfin /config/plugins
docker exec --user root jellyfin chmod -R 755 /config/plugins

# Restart container
docker restart jellyfin
```

#### For Native Linux Installations

```bash
# Create plugin directory
sudo mkdir -p /var/lib/jellyfin/plugins/Jellyfin.Plugin.Metafin_1.0.0.0

# Install plugin
sudo cp bin/Release/net8.0/Jellyfin.Plugin.Metafin.dll /var/lib/jellyfin/plugins/Jellyfin.Plugin.Metafin_1.0.0.0/

# Fix ownership and permissions
sudo chown -R jellyfin:jellyfin /var/lib/jellyfin/plugins
sudo chmod -R 755 /var/lib/jellyfin/plugins

# Restart Jellyfin
sudo systemctl restart jellyfin
```

#### For Alternative Plugin Directory

If you continue having permission issues, you can try using a different plugins directory:

1. **Create a custom plugins directory:**
   ```bash
   mkdir -p ~/jellyfin-plugins/Jellyfin.Plugin.Metafin_1.0.0.0
   cp bin/Release/net8.0/Jellyfin.Plugin.Metafin.dll ~/jellyfin-plugins/Jellyfin.Plugin.Metafin_1.0.0.0/
   ```

2. **Configure Jellyfin to use this directory:**
   - Add `--plugindir ~/jellyfin-plugins` to your Jellyfin startup command
   - Or set the `JELLYFIN_PLUGIN_DIR` environment variable

### Plugin Enable Checkbox Disabled

If the plugin appears in Jellyfin's plugin list but the enable checkbox can't be clicked:

1. **Plugin initialization failed:**
   - Check Jellyfin logs for plugin loading errors
   - Ensure all required properties are properly implemented
   - Verify the plugin DLL is compatible with your Jellyfin version

2. **Missing manifest file:**
   ```bash
   # Jellyfin might be unable to create the meta.json file
   # Check if the plugin directory is writable
   ls -la /path/to/plugins/Jellyfin.Plugin.Metafin_1.0.0.0/

   # Fix permissions if needed
   sudo chown -R jellyfin:jellyfin /path/to/plugins
   sudo chmod -R 755 /path/to/plugins
   ```

3. **Restart Jellyfin completely:**
   ```bash
   # Docker
   docker restart jellyfin

   # Native Linux
   sudo systemctl restart jellyfin
   ```

4. **Clear plugin cache:**
   - Remove the plugin folder completely
   - Restart Jellyfin
   - Reinstall the plugin with correct permissions

### Plugin Not Loading

If the plugin installs but doesn't appear in Jellyfin:

1. **Check Jellyfin logs:**
   ```bash
   # Docker
   docker logs jellyfin

   # Native Linux
   journalctl -u jellyfin -f
   ```

2. **Verify .NET version:**
   - Ensure your Jellyfin server has .NET 8.0 runtime installed
   - The plugin requires .NET 8.0 or later

3. **Check plugin file:**
   ```bash
   # Verify the DLL exists and has correct permissions
   ls -la /path/to/plugins/Jellyfin.Plugin.Metafin_1.0.0.0/

   # Check file type
   file /path/to/plugins/Jellyfin.Plugin.Metafin_1.0.0.0/Jellyfin.Plugin.Metafin.dll
   ```

### Plugin Configuration Issues

1. **Plugin appears but returns errors:**
   - Check that the API key in plugin settings matches your Jellyfin API key
   - Verify the Metafin server URL is accessible from Jellyfin
   - Test the `/metafin/status` endpoint manually

2. **Test plugin status endpoint:**
   ```bash
   curl http://your-jellyfin-server:8096/metafin/status
   ```

### Architecture Mismatch

If you get "BadImageFormatException" errors:

1. **Check your system architecture:**
   ```bash
   uname -m
   ```

2. **Use correct build:**
   - `x86_64` → Use `linux-x64` build
   - `aarch64` or `arm64` → Use `linux-arm64` build
   - When unsure → Use universal build (any CPU)

3. **Rebuild for correct architecture:**
   ```bash
   cd jellyfin-plugin-metafin

   # For x64
   dotnet build --configuration Release --runtime linux-x64

   # For ARM64
   dotnet build --configuration Release --runtime linux-arm64
   ```

### Docker-Specific Issues

1. **Container user mismatch:**
   ```bash
   # Check what user Jellyfin runs as inside container
   docker exec jellyfin id

   # Ensure plugin files are owned by that user
   docker exec --user root jellyfin chown -R jellyfin:jellyfin /config/plugins
   ```

2. **Volume mount issues:**
   ```bash
   # Verify plugins directory is properly mounted
   docker exec jellyfin ls -la /config/plugins
   ```

3. **SELinux issues (RHEL/CentOS):**
   ```bash
   # Temporarily disable SELinux for testing
   sudo setenforce 0

   # Or set correct SELinux context
   sudo setsebool -P container_manage_cgroup on
   ```

### Still Having Issues?

1. **Enable debug logging in Jellyfin:**
   - Go to Dashboard > Logs
   - Enable debug level logging
   - Restart Jellyfin and check logs

2. **Test with minimal setup:**
   - Try installing on a fresh Jellyfin instance
   - Use the universal build first
   - Test without other plugins

3. **Verify plugin integrity:**
   ```bash
   # Check if DLL is valid
   dotnet exec /path/to/Jellyfin.Plugin.Metafin.dll
   ```

4. **Common fixes:**
   - Restart Jellyfin after installation
   - Clear browser cache
   - Check firewall settings
   - Verify network connectivity between Jellyfin and Metafin

## Getting Help

If none of these solutions work:

1. Check Jellyfin version compatibility (requires 10.10.7+)
2. Verify .NET 8.0 runtime is available
3. Test with a minimal Jellyfin setup
4. Provide full error logs when seeking help