#!/bin/sh
set -e

# Reload systemd daemon after package removal
if [ -d /run/systemd/system ]; then
    systemctl daemon-reload || true
    systemctl reset-failed vpnhub-daemon.service || true
fi
