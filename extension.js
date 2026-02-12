import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Soup from 'gi://Soup?version=3.0';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const API_URL = 'https://api.anthropic.com/api/oauth/usage';

// ── Usage row: title + percentage on top, bar in middle, reset time below ───
const UsageRow = GObject.registerClass(
class UsageRow extends PopupMenu.PopupBaseMenuItem {
    _init(title, settings, params) {
        super._init({reactive: false, can_focus: false, ...params});

        this._settings = settings;
        this._box = new St.BoxLayout({vertical: true, x_expand: true});
        this.add_child(this._box);

        // Title … value
        const topLine = new St.BoxLayout({x_expand: true});
        this._box.add_child(topLine);

        this._title = new St.Label({
            text: title,
            style_class: 'claude-row-title',
            y_align: Clutter.ActorAlign.CENTER,
        });
        topLine.add_child(this._title);
        topLine.add_child(new St.Widget({x_expand: true}));

        this._value = new St.Label({
            text: '—',
            style_class: 'claude-row-value',
            y_align: Clutter.ActorAlign.CENTER,
        });
        topLine.add_child(this._value);

        // Bar
        this._barTrack = new St.Widget({
            style_class: 'claude-bar-track',
            x_expand: true,
        });
        this._box.add_child(this._barTrack);

        this._barFill = new St.Widget({
            style_class: 'claude-bar-fill',
        });
        this._barTrack.add_child(this._barFill);

        // Reset time
        this._resetLabel = new St.Label({
            text: '',
            style_class: 'claude-row-reset',
        });
        this._box.add_child(this._resetLabel);
    }

    update(pct, resetsAt) {
        if (pct === null || pct === undefined) {
            this._value.text = '—';
            this._barFill.width = 0;
            this._resetLabel.text = '';
            return;
        }

        const p = Math.round(pct);
        this._value.text = `${p}%`;

        // Bar color
        const warn = this._settings.get_int('warn-threshold');
        const crit = this._settings.get_int('crit-threshold');
        let color;
        if (p >= crit)
            color = this._settings.get_string('color-crit');
        else if (p >= warn)
            color = this._settings.get_string('color-warn');
        else
            color = this._settings.get_string('color-ok');
        this._barFill.set_style(`background-color: ${color};`);

        // Bar width as % of track
        const trackWidth = this._barTrack.width || 220;
        this._barFill.width = Math.max(0, (p / 100) * trackWidth);

        // Reset time
        if (resetsAt) {
            try {
                const dt = GLib.DateTime.new_from_iso8601(resetsAt, null);
                if (dt) {
                    const local = dt.to_local();
                    const now = GLib.DateTime.new_now_local();
                    const diff = local.difference(now) / 1000000;
                    const h = Math.floor(diff / 3600);
                    const m = Math.floor((diff % 3600) / 60);
                    const timeStr = local.format('%a %b %e, %l:%M %p');
                    if (diff > 0)
                        this._resetLabel.text = `Resets ${timeStr}  (${h}h ${m}m)`;
                    else
                        this._resetLabel.text = `Reset time passed`;
                } else {
                    this._resetLabel.text = '';
                }
            } catch (_e) {
                this._resetLabel.text = '';
            }
        } else {
            this._resetLabel.text = '';
        }
    }
});

// ── Panel indicator ─────────────────────────────────────────────────────────
const ClaudeUsageIndicator = GObject.registerClass(
class ClaudeUsageIndicator extends PanelMenu.Button {
    _init(extensionPath, settings) {
        super._init(0.0, 'Claude Code Usage', false);

        this._extensionPath = extensionPath;
        this._settings = settings;
        this._session = new Soup.Session();
        this._timeoutId = null;
        this._settingsChangedIds = [];
        this._settingsChangedIds.push(this._settings.connect(
            'changed::refresh-interval', () => this._restartTimer()
        ));
        for (const key of ['warn-threshold', 'crit-threshold', 'color-ok', 'color-warn', 'color-crit']) {
            this._settingsChangedIds.push(this._settings.connect(
                `changed::${key}`, () => this._refresh()
            ));
        }

        // ── Panel button: Claude icon + "5h% · 7d% · S%" ───────────────
        const panelBox = new St.BoxLayout({
            style_class: 'panel-status-indicators-box',
        });
        this.add_child(panelBox);

        // Claude icon from bundled SVG
        const iconPath = GLib.build_filenamev([extensionPath, 'icons', 'claude-symbolic.svg']);
        const gicon = Gio.icon_new_for_string(iconPath);
        this._icon = new St.Icon({
            gicon,
            style_class: 'system-status-icon',
        });
        panelBox.add_child(this._icon);

        this._panelLabel = new St.Label({
            text: '…',
            style_class: 'claude-panel-label',
            y_align: Clutter.ActorAlign.CENTER,
        });
        panelBox.add_child(this._panelLabel);

        // ── Dropdown ────────────────────────────────────────────────────
        const header = new PopupMenu.PopupMenuItem('Claude Code Usage', {
            reactive: false,
            can_focus: false,
        });
        header.label.add_style_class_name('claude-header-label');
        this.menu.addMenuItem(header);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._fiveHourRow = new UsageRow('Session  (5 h)', this._settings);
        this.menu.addMenuItem(this._fiveHourRow);

        this._sevenDayRow = new UsageRow('Weekly  (all models)', this._settings);
        this.menu.addMenuItem(this._sevenDayRow);

        this._sonnetRow = new UsageRow('Weekly  (Sonnet)', this._settings);
        this.menu.addMenuItem(this._sonnetRow);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._statusItem = new PopupMenu.PopupMenuItem('', {
            reactive: false,
            can_focus: false,
        });
        this._statusItem.label.add_style_class_name('claude-status-label');
        this.menu.addMenuItem(this._statusItem);

        const refreshItem = new PopupMenu.PopupMenuItem('↻  Refresh now');
        refreshItem.connect('activate', () => this._refresh());
        this.menu.addMenuItem(refreshItem);

        this._refresh();
        this._startTimer();
    }

    _getToken() {
        const credPath = GLib.build_filenamev([
            GLib.get_home_dir(), '.claude', '.credentials.json',
        ]);
        const file = Gio.File.new_for_path(credPath);
        if (!file.query_exists(null)) return null;

        const [ok, contents] = file.load_contents(null);
        if (!ok) return null;

        try {
            const creds = JSON.parse(new TextDecoder().decode(contents));
            if (creds?.claudeAiOauth?.accessToken)
                return creds.claudeAiOauth.accessToken;
            for (const val of Object.values(creds)) {
                if (val?.accessToken) return val.accessToken;
            }
        } catch (_e) { /* ignore */ }
        return null;
    }

    _refresh() {
        const token = this._getToken();
        if (!token) {
            this._setError('No credentials found');
            return;
        }

        const msg = Soup.Message.new('GET', API_URL);
        msg.request_headers.append('Authorization', `Bearer ${token}`);
        msg.request_headers.append('User-Agent', 'claude-code/2.1.39');
        msg.request_headers.append('anthropic-beta', 'oauth-2025-04-20');

        this._session.send_and_read_async(
            msg, GLib.PRIORITY_DEFAULT, null,
            (session, result) => {
                try {
                    const bytes = session.send_and_read_finish(result);
                    if (msg.get_status() !== Soup.Status.OK) {
                        this._setError(`API ${msg.get_status()}`);
                        return;
                    }
                    const text = new TextDecoder().decode(bytes.get_data());
                    const data = JSON.parse(text);
                    this._updateUI(data);
                } catch (e) {
                    this._setError(e.message ?? 'fetch failed');
                }
            }
        );
    }

    _updateUI(data) {
        const fh = data.five_hour;
        const sd = data.seven_day;
        const sn = data.seven_day_sonnet;

        this._fiveHourRow.update(fh?.utilization ?? null, fh?.resets_at);
        this._sevenDayRow.update(sd?.utilization ?? null, sd?.resets_at);
        this._sonnetRow.update(sn?.utilization ?? null, sn?.resets_at);

        // Panel label: all three values
        const fhPct = fh ? Math.round(fh.utilization) : '?';
        const sdPct = sd ? Math.round(sd.utilization) : '?';
        const snPct = sn ? Math.round(sn.utilization) : '?';
        this._panelLabel.text = `${fhPct}% · ${sdPct}% · ${snPct}%`;

        // Colour the panel text when any bucket is high
        const maxPct = Math.max(
            fh?.utilization ?? 0,
            sd?.utilization ?? 0,
            sn?.utilization ?? 0
        );
        const warn = this._settings.get_int('warn-threshold');
        const crit = this._settings.get_int('crit-threshold');
        if (maxPct >= crit)
            this._panelLabel.set_style(`color: ${this._settings.get_string('color-crit')};`);
        else if (maxPct >= warn)
            this._panelLabel.set_style(`color: ${this._settings.get_string('color-warn')};`);
        else
            this._panelLabel.set_style('');

        const now = GLib.DateTime.new_now_local();
        this._statusItem.label.text = `Updated ${now.format('%l:%M %p')}`;
    }

    _setError(msg) {
        this._panelLabel.text = '⚠';
        this._statusItem.label.text = `Error: ${msg}`;
    }

    _startTimer() {
        const interval = this._settings.get_int('refresh-interval');
        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            interval,
            () => {
                this._refresh();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    _restartTimer() {
        this._stopTimer();
        this._startTimer();
    }

    _stopTimer() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }
    }

    destroy() {
        this._stopTimer();
        if (this._settingsChangedIds) {
            for (const id of this._settingsChangedIds)
                this._settings.disconnect(id);
            this._settingsChangedIds = null;
        }
        this._settings = null;
        this._session = null;
        super.destroy();
    }
});

// ── Entry point ─────────────────────────────────────────────────────────────
export default class ClaudeUsageExtension extends Extension {
    enable() {
        this._indicator = new ClaudeUsageIndicator(this.path, this.getSettings());
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
