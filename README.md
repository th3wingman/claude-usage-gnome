# Claude Code Usage — GNOME Shell Extension

A lightweight panel indicator for Ubuntu 24.04 (GNOME 46) that shows your
Claude Code token usage without opening the CLI.

## What it shows

**Top bar:** `5h% · 7d%` — your 5-hour session and 7-day weekly usage at a glance.

**Dropdown menu:**
- Session (5 h) — current rolling window usage + reset time
- Weekly (all models) — 7-day cap across all models + reset time
- Weekly (Sonnet) — Sonnet-specific weekly usage + reset time
- Color-coded bars: green → yellow (50%+) → red (80%+)

## Requirements

- Ubuntu 24.04 / GNOME Shell 46
- Claude Code installed and logged in at least once
  (credentials must exist at `~/.claude/.credentials.json`)

## Install

```bash
chmod +x install.sh
./install.sh
```

Then restart GNOME Shell and enable:

```bash
# X11: Alt+F2 → r → Enter
# Wayland: log out / log in

gnome-extensions enable claude-usage@claude-code
```

## Uninstall

```bash
./install.sh uninstall
```

## Configuration

Edit the `REFRESH_SECONDS` constant in `extension.js` to change the polling
interval (default: 300 s / 5 min).

## How it works

Reads your OAuth token from `~/.claude/.credentials.json` and calls the same
internal API endpoint (`/api/oauth/usage`) that Claude Code's `/usage` command
uses. This is an undocumented endpoint — it may change in future versions.
