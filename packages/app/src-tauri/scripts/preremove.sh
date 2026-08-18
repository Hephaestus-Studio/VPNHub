#!/bin/sh
set -e

# Stop and disable vpnhub-daemon service before package removal
if [ -d /run/systemd/system ]; then
    systemctl stop vpnhub-daemon.service || true
    systemctl disable vpnhub-daemon.service || true
fi
