#!/bin/sh
set -e

# Stop and disable vpnhub-daemon service before package removal
if [ -d /run/systemd/system ]; then
    systemctl stop vpnhub-daemon.service >/dev/null 2>&1 || true
    systemctl disable vpnhub-daemon.service >/dev/null 2>&1 || true
fi
