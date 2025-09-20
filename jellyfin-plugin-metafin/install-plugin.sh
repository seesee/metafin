#!/bin/bash

# Jellyfin Plugin Metafin Installation Script
# This script helps install the plugin with correct permissions

set -e

PLUGIN_NAME="Jellyfin.Plugin.Metafin"
PLUGIN_VERSION="1.0.0.0"
PLUGIN_DIR_NAME="${PLUGIN_NAME}_${PLUGIN_VERSION}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to detect installation type
detect_installation() {
    if docker ps --format "table {{.Names}}" | grep -q jellyfin 2>/dev/null; then
        echo "docker"
    elif systemctl is-active --quiet jellyfin 2>/dev/null; then
        echo "systemd"
    elif pgrep -f jellyfin >/dev/null 2>&1; then
        echo "process"
    else
        echo "unknown"
    fi
}

# Function to find plugins directory
find_plugins_dir() {
    local install_type=$1

    case $install_type in
        "docker")
            # Try to find the mounted config directory
            local mount_point=$(docker inspect jellyfin 2>/dev/null | jq -r '.[0].Mounts[] | select(.Destination == "/config") | .Source' 2>/dev/null || echo "")
            if [[ -n "$mount_point" ]]; then
                echo "${mount_point}/plugins"
            else
                print_warning "Could not auto-detect Docker mount point. Please specify manually."
                echo ""
            fi
            ;;
        "systemd"|"process")
            # Common locations for native installations
            for dir in "/var/lib/jellyfin/plugins" "/home/jellyfin/.local/share/jellyfin/plugins" "/opt/jellyfin/plugins"; do
                if [[ -d "$dir" ]] || [[ -d "$(dirname "$dir")" ]]; then
                    echo "$dir"
                    return
                fi
            done
            echo "/var/lib/jellyfin/plugins"
            ;;
        *)
            echo "/var/lib/jellyfin/plugins"
            ;;
    esac
}

# Function to install plugin
install_plugin() {
    local plugins_dir="$1"
    local dll_path="$2"
    local install_type="$3"

    print_status "Installing plugin to: $plugins_dir"

    # Create plugin directory
    local plugin_path="${plugins_dir}/${PLUGIN_DIR_NAME}"

    case $install_type in
        "docker")
            # Docker installation
            print_status "Installing via Docker..."

            # Create directory inside container
            docker exec jellyfin mkdir -p "/config/plugins/${PLUGIN_DIR_NAME}" 2>/dev/null || {
                print_error "Failed to create directory in container. Trying with root user..."
                docker exec --user root jellyfin mkdir -p "/config/plugins/${PLUGIN_DIR_NAME}"
            }

            # Copy plugin
            docker cp "$dll_path" "jellyfin:/config/plugins/${PLUGIN_DIR_NAME}/" || {
                print_error "Failed to copy plugin to container"
                return 1
            }

            # Fix permissions
            docker exec --user root jellyfin chown -R jellyfin:jellyfin "/config/plugins" 2>/dev/null || {
                print_warning "Could not change ownership (this might be okay)"
            }
            docker exec --user root jellyfin chmod -R 755 "/config/plugins" 2>/dev/null || {
                print_warning "Could not change permissions (this might be okay)"
            }
            ;;
        *)
            # Native installation
            print_status "Installing on native system..."

            # Create directory
            sudo mkdir -p "$plugin_path" || {
                print_error "Failed to create plugin directory: $plugin_path"
                return 1
            }

            # Copy plugin
            sudo cp "$dll_path" "$plugin_path/" || {
                print_error "Failed to copy plugin file"
                return 1
            }

            # Fix permissions
            sudo chown -R jellyfin:jellyfin "$plugins_dir" 2>/dev/null || {
                print_warning "Could not change ownership to jellyfin:jellyfin (trying alternative users...)"
                # Try alternative users
                for user in jellyfin-media jellyfin-server media; do
                    if id "$user" >/dev/null 2>&1; then
                        sudo chown -R "$user:$user" "$plugins_dir" && break
                    fi
                done
            }
            sudo chmod -R 755 "$plugins_dir" || {
                print_warning "Could not change directory permissions"
            }
            ;;
    esac

    print_success "Plugin files installed successfully"
}

# Function to restart Jellyfin
restart_jellyfin() {
    local install_type="$1"

    print_status "Restarting Jellyfin..."

    case $install_type in
        "docker")
            docker restart jellyfin || {
                print_error "Failed to restart Jellyfin container"
                return 1
            }
            ;;
        "systemd")
            sudo systemctl restart jellyfin || {
                print_error "Failed to restart Jellyfin service"
                return 1
            }
            ;;
        *)
            print_warning "Please restart Jellyfin manually"
            return 0
            ;;
    esac

    print_success "Jellyfin restarted successfully"
}

# Main installation function
main() {
    print_status "Jellyfin Plugin Metafin Installation Script"
    echo

    # Check if plugin DLL exists
    local dll_path="bin/Release/net8.0/Jellyfin.Plugin.Metafin.dll"
    if [[ ! -f "$dll_path" ]]; then
        print_error "Plugin DLL not found at: $dll_path"
        print_status "Please build the plugin first:"
        echo "  dotnet build --configuration Release"
        exit 1
    fi

    print_success "Found plugin DLL: $dll_path"

    # Detect installation type
    local install_type=$(detect_installation)
    print_status "Detected installation type: $install_type"

    # Find plugins directory
    local plugins_dir=$(find_plugins_dir "$install_type")

    if [[ -z "$plugins_dir" ]]; then
        print_error "Could not determine plugins directory"
        echo "Please specify the path manually:"
        read -p "Plugins directory path: " plugins_dir
    fi

    print_status "Using plugins directory: $plugins_dir"

    # Confirm installation
    echo
    print_warning "This will install the Metafin plugin to Jellyfin"
    print_status "Installation type: $install_type"
    print_status "Plugins directory: $plugins_dir"
    print_status "Plugin DLL: $dll_path"
    echo
    read -p "Continue? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Installation cancelled"
        exit 0
    fi

    # Install plugin
    install_plugin "$plugins_dir" "$dll_path" "$install_type" || {
        print_error "Plugin installation failed"
        exit 1
    }

    # Restart Jellyfin
    restart_jellyfin "$install_type" || {
        print_warning "Jellyfin restart failed - please restart manually"
    }

    echo
    print_success "Plugin installation completed!"
    print_status "Next steps:"
    echo "  1. Open Jellyfin admin dashboard"
    echo "  2. Go to Dashboard > Plugins"
    echo "  3. Find 'Metafin' in the plugin list"
    echo "  4. Enable the plugin and configure settings"
    echo "  5. Test the status endpoint: http://your-jellyfin:8096/metafin/status"
    echo
    print_status "If the enable checkbox is still disabled, check the troubleshooting guide:"
    echo "  cat TROUBLESHOOTING.md"
}

# Run main function
main "$@"