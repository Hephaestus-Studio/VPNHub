#!/bin/sh
set -e

# Reload systemd and enable/start vpnhub-daemon service
if [ -d /run/systemd/system ]; then
    systemctl daemon-reload
    systemctl enable --now vpnhub-daemon.service || true
fi
