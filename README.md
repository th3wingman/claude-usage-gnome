# Claude Code Usage — GNOME Shell Extension

A lightweight panel indicator for Ubuntu 24.04 (GNOME 46) that shows your
Claude Code token usage without opening the CLI.

## What it shows

**Top bar:** Claude icon + `7% · 4% · 0%` — session, weekly, and Sonnet usage.
Text turns yellow at 50% and red at 80%.

**Dropdown menu:**
- Session (5 h) — current rolling window usage + reset countdown
- Weekly (all models) — 7-day cap usage + reset time
- Weekly (Sonnet) — Sonnet-specific weekly usage + reset time
- Color-coded progress bars (green → yellow → red)

## Requirements

- Ubuntu 24.04 / GNOME Shell 46
- Claude Code installed and logged in at least once
  (credentials at `~/.claude/.credentials.json`)

## Install

```bash
chmod +x install.sh
./install.sh
```

Then restart GNOME Shell and enable:

```bash
# X11: Alt+F2 → r → Enter
# Wayland: log out / log in

gnome-extensions enable claude-usage@th3wingman
```

## Uninstall

```bash
./install.sh uninstall
```

## Configuration

Open the preferences dialog to change the polling interval (default 300 s):

```bash
gnome-extensions prefs claude-usage@th3wingman
```

Or click the gear icon in Extension Manager.

The interval can be set between 30 and 3600 seconds. Changes take effect immediately.

## Icon

Uses the Claude icon from [Bootstrap Icons](https://icons.getbootstrap.com/icons/claude/) (MIT license).

## How it works

Reads your OAuth token from `~/.claude/.credentials.json` and calls the same
internal API endpoint (`/api/oauth/usage`) that Claude Code's `/usage` command
uses. This is an undocumented endpoint and may change in future versions.

## Notes

**"See Details" in Extension Manager** shows an error — this is expected.
Extension Manager fetches details from extensions.gnome.org by UUID; since the
extension isn't published there, the lookup fails. This doesn't affect
functionality. See the [GitHub repo](https://github.com/th3wingman/claude-usage-gnome)
for details instead.

## License

MIT
