# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GNOME Shell 46 extension (Ubuntu 24.04) that displays Claude Code token usage limits in the top panel. It polls the Anthropic OAuth usage API every 5 minutes and shows up to five metrics: session (5-hour), weekly (all models), weekly (Sonnet), weekly (Opus, auto-hidden when unavailable), and extra usage (shown when billing is enabled).

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
- `ClaudeUsageIndicator` — panel button + dropdown menu. Handles credential loading (`~/.claude/.credentials.json`), token expiry checking, HTTP polling via libsoup, error differentiation (401/403/429), and UI updates.
- `UsageRow` — custom `PopupMenu.PopupBaseMenuItem` that renders a compact row: title + reset countdown + percentage on one line, progress bar below, with configurable color thresholds.

Data flow: read OAuth token from `~/.claude/.credentials.json` → check `expiresAt` (skip API call if expired) → GET `https://api.anthropic.com/api/oauth/usage` → differentiate HTTP errors (401/403/429) → parse `five_hour`, `seven_day`, `seven_day_sonnet`, `seven_day_opus`, `extra_usage` fields → update bars and panel label. The Opus row auto-hides when the API returns no data. The extra usage row appears only when `is_enabled` is true.

**stylesheet.css** — progress bar and panel label structural styling. Colors are applied inline from GSettings.

**prefs.js** — preferences window using libadwaita (`Adw.SpinRow`, `Adw.SwitchRow`, `Adw.EntryRow`), bound to GSettings.

**schemas/org.gnome.shell.extensions.claude-usage.gschema.xml** — GSettings schema for all configurable keys.

**install.sh** — bash script (`set -euo pipefail`) that copies extension files to the GNOME extensions directory and compiles the GSettings schema.

## Settings

All settings are configurable via GSettings (`org.gnome.shell.extensions.claude-usage`). Schema XML lives in `schemas/`, compiled at install time. `prefs.js` provides the preferences UI. The extension connects to `changed` signals so all settings take effect live.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `refresh-interval` | `i` | 300 | Seconds between API polls (30–3600) |
| `warn-threshold` | `i` | 50 | % at which bars/panel turn warning color (1–99) |
| `crit-threshold` | `i` | 80 | % at which bars/panel turn critical color (1–99) |
| `color-ok` | `s` | `#73c48f` | Bar color below warn threshold |
| `color-warn` | `s` | `#f5a623` | Bar + panel color at warn threshold |
| `color-crit` | `s` | `#e74c3c` | Bar + panel color at crit threshold |
| `show-session` | `b` | `true` | Show session (5h) usage in panel |
| `show-weekly` | `b` | `true` | Show weekly (all models) usage in panel |
| `show-sonnet` | `b` | `true` | Show weekly (Sonnet) usage in panel |
| `show-opus` | `b` | `true` | Show weekly (Opus) usage in panel (only when API data present) |

Colors are applied via inline `style` attributes (not CSS classes) so user values take effect immediately.

## Key Constants (extension.js)

- `API_URL` — `https://api.anthropic.com/api/oauth/usage`
- User-Agent: `claude-code/2.1.90`
- Beta header: `anthropic-beta: oauth-2025-04-20`
- Credentials path: `~/.claude/.credentials.json` (reads `claudeAiOauth.accessToken` and `claudeAiOauth.expiresAt`)

## Conventions

- GObject classes registered with `GObject.registerClass()`
- All imports are GNOME platform libs (GLib, Gio, St, Clutter, Soup) — no npm dependencies
- Section headers use `// ──` comment style
- Module-level constants in UPPER_CASE
- Compact layout: reset countdown inline with title/percentage, refresh button doubles as status line
