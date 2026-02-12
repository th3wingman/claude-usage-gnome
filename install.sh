#!/usr/bin/env bash
# install.sh — Install or uninstall the Claude Code Usage GNOME extension
set -euo pipefail

UUID="claude-usage@claude-code"
EXT_DIR="${HOME}/.local/share/gnome-shell/extensions/${UUID}"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

case "${1:-install}" in
    install)
        echo "Installing ${UUID} …"
        mkdir -p "${EXT_DIR}"
        cp "${SRC_DIR}/metadata.json"  "${EXT_DIR}/"
        cp "${SRC_DIR}/extension.js"   "${EXT_DIR}/"
        cp "${SRC_DIR}/stylesheet.css" "${EXT_DIR}/"
        echo "Installed to ${EXT_DIR}"
        echo ""
        echo "Next steps:"
        echo "  1. Restart GNOME Shell:"
        echo "       X11:    Alt+F2 → type 'r' → Enter"
        echo "       Wayland: log out and back in"
        echo "  2. Enable the extension:"
        echo "       gnome-extensions enable ${UUID}"
        echo ""
        echo "  Or use Extension Manager / GNOME Extensions app to enable it."
        ;;
    uninstall|remove)
        echo "Removing ${UUID} …"
        gnome-extensions disable "${UUID}" 2>/dev/null || true
        rm -rf "${EXT_DIR}"
        echo "Done. Restart GNOME Shell to complete removal."
        ;;
    *)
        echo "Usage: $0 [install|uninstall]"
        exit 1
        ;;
esac
