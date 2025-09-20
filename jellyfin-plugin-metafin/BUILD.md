# Building the Jellyfin Plugin Metafin

## Prerequisites

You'll need the .NET 8.0 SDK installed to compile the plugin. .NET 9.0 is also supported.

### Installing .NET 8.0 SDK

**macOS:**
```bash
# Using Homebrew
brew install dotnet

# Or download from Microsoft
curl -sSL https://dot.net/v1/dotnet-install.sh | bash /dev/stdin --channel 8.0
```

**Linux (Ubuntu/Debian):**
```bash
# Add Microsoft package repository
wget https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
rm packages-microsoft-prod.deb

# Install .NET SDK
sudo apt-get update
sudo apt-get install -y dotnet-sdk-8.0
```

**Windows:**
Download and install from: https://dotnet.microsoft.com/download/dotnet/8.0

## Building for Different Architectures

### x64 (Intel/AMD) Architecture

```bash
cd jellyfin-plugin-metafin
dotnet restore
dotnet build --configuration Release --runtime linux-x64
```

**Output location:** `bin/Release/net8.0/linux-x64/`

### ARM64 Architecture

```bash
cd jellyfin-plugin-metafin
dotnet restore
dotnet build --configuration Release --runtime linux-arm64
```

**Output location:** `bin/Release/net8.0/linux-arm64/`

### Cross-Platform Build (Any CPU)

For maximum compatibility (works on both x64 and ARM64):

```bash
cd jellyfin-plugin-metafin
dotnet restore
dotnet build --configuration Release
```

**Output location:** `bin/Release/net8.0/`

## Generated Files

After building, you'll find these important files:

- `Jellyfin.Plugin.Metafin.dll` - Main plugin assembly
- `Jellyfin.Plugin.Metafin.deps.json` - Dependency information
- `Jellyfin.Plugin.Metafin.pdb` - Debug symbols (optional)

## Verification

To verify the build succeeded:

```bash
# Check the output directory
ls -la bin/Release/net8.0/

# Verify the main DLL exists
file bin/Release/net8.0/Jellyfin.Plugin.Metafin.dll
```

## Docker Build (Alternative)

If you don't want to install .NET locally, you can build using Docker:

### x64 Build with Docker

```bash
# Create a build container
docker run --rm -v "$(pwd)":/workspace -w /workspace mcr.microsoft.com/dotnet/sdk:8.0 \
  dotnet build --configuration Release --runtime linux-x64

# Or build for any CPU
docker run --rm -v "$(pwd)":/workspace -w /workspace mcr.microsoft.com/dotnet/sdk:8.0 \
  dotnet build --configuration Release
```

### ARM64 Build with Docker

```bash
# Use ARM64 container for native build
docker run --rm --platform linux/arm64 -v "$(pwd)":/workspace -w /workspace mcr.microsoft.com/dotnet/sdk:8.0 \
  dotnet build --configuration Release --runtime linux-arm64
```

## Next Steps

After building, proceed to the installation instructions in `INSTALLATION.md`.