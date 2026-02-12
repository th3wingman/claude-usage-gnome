# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GNOME Shell 46 extension (Ubuntu 24.04) that displays Claude Code token usage limits in the top panel. It polls the Anthropic OAuth usage API every 5 minutes and shows three metrics: session (5-hour), weekly (all models), and weekly (Sonnet).

## Install / Uninstall

```bash
./install.sh            # copies files to ~/.local/share/gnome-shell/extensions/claude-usage@th3wingman/
./install.sh uninstall  # removes the extension directory
```

After install, restart GNOME Shell and run `gnome-extensions enable claude-usage@th3wingman`.

No build step — GNOME Shell loads the JS/CSS directly.

## Architecture

**extension.js** is the entire extension. Key classes:

- `ClaudeUsageExtension` — entry point; implements `enable()`/`disable()` lifecycle hooks.
- `ClaudeUsageIndicator` — panel button + dropdown menu. Handles credential loading (`~/.claude/.credentials.json`), HTTP polling via libsoup, and UI updates.
- `UsageRow` — custom `PopupMenu.PopupBaseMenuItem` that renders a labeled progress bar with color coding (green/yellow/red at 0%/50%/80%) and a reset countdown.

Data flow: read OAuth token → GET `https://api.anthropic.com/api/oauth/usage` → parse `five_hour`, `seven_day`, `seven_day_sonnet` utilization fields → update bars and panel label.

**stylesheet.css** — progress bar and panel label styling. Color thresholds match the JS logic.

**prefs.js** — preferences window using libadwaita (`Adw.SpinRow`), bound to GSettings.

**schemas/org.gnome.shell.extensions.claude-usage.gschema.xml** — GSettings schema with `refresh-interval` key.

**install.sh** — bash script (`set -euo pipefail`) that copies extension files to the GNOME extensions directory and compiles the GSettings schema.

## Settings

Refresh interval is configurable via GSettings (`org.gnome.shell.extensions.claude-usage`). Schema XML lives in `schemas/`, compiled at install time. `prefs.js` provides the preferences UI (Adw.SpinRow, 30–3600s). The extension connects to `changed::refresh-interval` to restart its timer live.

## Key Constants (extension.js)

- `API_URL` — usage endpoint
- User-Agent and beta header are hardcoded

## Conventions

- GObject classes registered with `GObject.registerClass()`
- All imports are GNOME platform libs (GLib, Gio, St, Clutter, Soup) — no npm dependencies
- Section headers use `// ──` comment style
- Module-level constants in UPPER_CASE
