#!/usr/bin/env bash
set -euo pipefail

UUID="claude-usage@th3wingman"
EXT_DIR="${HOME}/.local/share/gnome-shell/extensions/${UUID}"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

case "${1:-install}" in
    install)
        echo "Installing ${UUID} …"
        mkdir -p "${EXT_DIR}/icons" "${EXT_DIR}/schemas"
        cp "${SRC_DIR}/metadata.json"  "${EXT_DIR}/"
        cp "${SRC_DIR}/extension.js"   "${EXT_DIR}/"
        cp "${SRC_DIR}/stylesheet.css" "${EXT_DIR}/"
        cp "${SRC_DIR}/prefs.js"       "${EXT_DIR}/"
        cp "${SRC_DIR}/icons/claude-symbolic.svg" "${EXT_DIR}/icons/"
        cp "${SRC_DIR}/schemas/"*.xml  "${EXT_DIR}/schemas/"
        glib-compile-schemas "${EXT_DIR}/schemas/"
        echo "Installed to ${EXT_DIR}"
        echo ""
        echo "Next steps:"
        echo "  1. Restart GNOME Shell:"
        echo "       X11:    Alt+F2 → type 'r' → Enter"
        echo "       Wayland: log out and back in"
        echo "  2. Enable the extension:"
        echo "       gnome-extensions enable ${UUID}"
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
