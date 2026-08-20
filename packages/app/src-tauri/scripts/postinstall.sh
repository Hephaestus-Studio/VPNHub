#!/bin/sh
set -e

# Reload systemd and enable/start vpnhub-daemon service
if [ -d /run/systemd/system ]; then
    systemctl daemon-reload >/dev/null 2>&1 || true
    systemctl enable --now vpnhub-daemon.service >/dev/null 2>&1 || true
fi
