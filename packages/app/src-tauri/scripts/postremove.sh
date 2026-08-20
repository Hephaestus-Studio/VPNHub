#!/bin/sh
set -e

# Reload systemd daemon after package removal
if [ -d /run/systemd/system ]; then
    systemctl daemon-reload >/dev/null 2>&1 || true
    systemctl reset-failed vpnhub-daemon.service >/dev/null 2>&1 || true
fi
