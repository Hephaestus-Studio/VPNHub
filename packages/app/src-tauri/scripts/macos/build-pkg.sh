#!/bin/bash
set -e

APP_PATH="${1:-target/release/bundle/macos/VPNHub.app}"
OUTPUT_PKG="${2:-target/release/bundle/macos/VPNHub_0.1.0_universal.pkg}"
SCRIPTS_DIR="$(dirname "$0")"

if [ ! -d "$APP_PATH" ]; then
    echo "Error: App bundle not found at $APP_PATH"
    echo "Please run 'pnpm tauri build --bundles app' first."
    exit 1
fi

echo "Building macOS .pkg installer from $APP_PATH..."

# Ensure LaunchDaemon plist is bundled in Resources
mkdir -p "$APP_PATH/Contents/Resources"
cp "$SCRIPTS_DIR/com.hephaestus-studio.vpnhub.daemon.plist" "$APP_PATH/Contents/Resources/"

# Ensure postinstall script is executable
chmod +x "$SCRIPTS_DIR/postinstall"

# Package into .pkg using Apple's pkgbuild tool
mkdir -p "$(dirname "$OUTPUT_PKG")"
pkgbuild --component "$APP_PATH" \
         --install-location "/Applications" \
         --scripts "$SCRIPTS_DIR" \
         --identifier "com.hephaestus-studio.vpnhub.pkg" \
         "$OUTPUT_PKG"

echo "Successfully created macOS package: $OUTPUT_PKG"
