# Architecture Detection Guide

This guide helps you determine which build target to use for your Jellyfin server.

## Quick Detection Commands

### Linux/macOS/Unix Systems

```bash
# Check CPU architecture
uname -m

# Possible outputs:
# x86_64   -> Use linux-x64 build
# aarch64  -> Use linux-arm64 build
# arm64    -> Use linux-arm64 build
```

### Docker Containers

```bash
# Check the host architecture (where Docker is running)
docker version --format '{{.Server.Arch}}'

# Or check inside a running container
docker exec jellyfin uname -m
```

### Windows Systems

```powershell
# Check processor architecture
$env:PROCESSOR_ARCHITECTURE

# Possible outputs:
# AMD64    -> Use linux-x64 build (for Linux containers)
# ARM64    -> Use linux-arm64 build (for Linux containers)
```

## Common Platforms

| Platform | Architecture | Build Target |
|----------|-------------|--------------|
| Intel/AMD PCs | x86_64 | `linux-x64` |
| Raspberry Pi 4/5 | aarch64/arm64 | `linux-arm64` |
| Apple Silicon Mac (M1/M2/M3) | arm64 | `linux-arm64` |
| AWS Graviton instances | aarch64 | `linux-arm64` |
| Most VPS providers | x86_64 | `linux-x64` |
| Synology NAS (recent) | x86_64 | `linux-x64` |
| QNAP NAS (recent) | x86_64 | `linux-x64` |

## Build Commands Reference

### x64 Build (Most Common)
```bash
dotnet build --configuration Release --runtime linux-x64
```

### ARM64 Build (Raspberry Pi, Apple Silicon servers)
```bash
dotnet build --configuration Release --runtime linux-arm64
```

### Universal Build (Works on both, larger file size)
```bash
dotnet build --configuration Release
```

## When in Doubt

If you're unsure about your architecture:

1. **Use the universal build** - it's larger but works on both architectures
2. **Check your Jellyfin container logs** for architecture information
3. **Try x64 first** - it's the most common architecture

## Troubleshooting Architecture Mismatches

If you get errors like "BadImageFormatException" or "platform not supported":

1. You've likely used the wrong architecture build
2. Rebuild for the correct target architecture
3. Replace the plugin file in the Jellyfin plugins directory
4. Restart Jellyfin