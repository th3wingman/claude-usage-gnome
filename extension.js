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

// ── Usage row: title + percentage on top, bar below, optional reset ────
const UsageRow = GObject.registerClass(
class UsageRow extends PopupMenu.PopupBaseMenuItem {
    _init(title, settings, params) {
        super._init({reactive: false, can_focus: false, ...params});
        this.add_style_class_name('claude-usage-row');

        this._settings = settings;
        this._box = new St.BoxLayout({vertical: true, x_expand: true});
        this.add_child(this._box);

        // Title … value … reset
        const topLine = new St.BoxLayout({x_expand: true});
        this._box.add_child(topLine);

        this._title = new St.Label({
            text: title,
            style_class: 'claude-row-title',
            y_align: Clutter.ActorAlign.CENTER,
        });
        topLine.add_child(this._title);
        topLine.add_child(new St.Widget({x_expand: true}));

        this._resetLabel = new St.Label({
            text: '',
            style_class: 'claude-row-reset',
            y_align: Clutter.ActorAlign.CENTER,
        });
        topLine.add_child(this._resetLabel);

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

        // Reset countdown
        if (resetsAt) {
            try {
                const dt = GLib.DateTime.new_from_iso8601(resetsAt, null);
                if (dt) {
                    const now = GLib.DateTime.new_now_local();
                    const diff = dt.to_local().difference(now) / 1000000;
                    if (diff > 0) {
                        const h = Math.floor(diff / 3600);
                        const m = Math.floor((diff % 3600) / 60);
                        if (h >= 24) {
                            const d = Math.floor(h / 24);
                            this._resetLabel.text = `↻ ${d}d ${h % 24}h`;
                        } else {
                            this._resetLabel.text = `↻ ${h}h ${m}m`;
                        }
                    } else {
                        this._resetLabel.text = '↻ resetting…';
                    }
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
        for (const key of ['warn-threshold', 'crit-threshold', 'color-ok', 'color-warn', 'color-crit',
                            'show-session', 'show-weekly', 'show-sonnet', 'show-opus']) {
            this._settingsChangedIds.push(this._settings.connect(
                `changed::${key}`, () => this._refresh()
            ));
        }

        // ── Panel button ────────────────────────────────────────────────
        const panelBox = new St.BoxLayout({
            style_class: 'panel-status-indicators-box',
        });
        this.add_child(panelBox);

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

        this._fiveHourRow = new UsageRow('Session (5h)', this._settings);
        this.menu.addMenuItem(this._fiveHourRow);

        this._sevenDayRow = new UsageRow('Weekly (all)', this._settings);
        this.menu.addMenuItem(this._sevenDayRow);

        this._sonnetRow = new UsageRow('Weekly (Sonnet)', this._settings);
        this.menu.addMenuItem(this._sonnetRow);

        this._opusRow = new UsageRow('Weekly (Opus)', this._settings);
        this._opusRow.visible = false;
        this.menu.addMenuItem(this._opusRow);

        this._extraRow = new UsageRow('Extra Usage', this._settings);
        this._extraRow.visible = false;
        this.menu.addMenuItem(this._extraRow);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._refreshItem = new PopupMenu.PopupMenuItem('↻  Refresh');
        this._refreshItem.label.add_style_class_name('claude-refresh-label');
        this._refreshItem.connect('activate', () => this._refresh());
        this.menu.addMenuItem(this._refreshItem);

        this._refresh();
        this._startTimer();
    }

    _getToken() {
        const credPath = GLib.build_filenamev([
            GLib.get_home_dir(), '.claude', '.credentials.json',
        ]);
        const file = Gio.File.new_for_path(credPath);
        if (!file.query_exists(null))
            return {error: 'No credentials found'};

        const [ok, contents] = file.load_contents(null);
        if (!ok) return {error: 'Cannot read credentials'};

        try {
            const creds = JSON.parse(new TextDecoder().decode(contents));
            const oauth = creds?.claudeAiOauth;
            if (oauth?.accessToken) {
                if (oauth.expiresAt && Date.now() >= oauth.expiresAt)
                    return {error: 'Token expired \u2014 run Claude Code to refresh'};
                return {token: oauth.accessToken};
            }
            for (const val of Object.values(creds)) {
                if (val?.accessToken) return {token: val.accessToken};
            }
        } catch (_e) { /* ignore */ }
        return {error: 'No credentials found'};
    }

    _refresh() {
        const cred = this._getToken();
        if (cred.error) {
            this._setError(cred.error);
            return;
        }

        const msg = Soup.Message.new('GET', API_URL);
        msg.request_headers.append('Authorization', `Bearer ${cred.token}`);
        msg.request_headers.append('User-Agent', 'claude-code/2.1.90');
        msg.request_headers.append('anthropic-beta', 'oauth-2025-04-20');

        this._session.send_and_read_async(
            msg, GLib.PRIORITY_DEFAULT, null,
            (session, result) => {
                try {
                    const bytes = session.send_and_read_finish(result);
                    const status = msg.status_code;
                    if (status !== 200) {
                        switch (status) {
                        case 401:
                            this._setError('Auth failed \u2014 token may be expired');
                            break;
                        case 403:
                            this._setError('Access denied');
                            break;
                        case 429:
                            this._setError('Rate limited \u2014 retry later', true);
                            break;
                        default:
                            this._setError(`API error ${status}`);
                        }
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
        const op = data.seven_day_opus;
        const eu = data.extra_usage;

        this._fiveHourRow.update(fh?.utilization ?? null, fh?.resets_at);
        this._sevenDayRow.update(sd?.utilization ?? null, sd?.resets_at);
        this._sonnetRow.update(sn?.utilization ?? null, sn?.resets_at);

        // Opus — only show row when API returns data
        this._opusRow.visible = !!op;
        if (op) this._opusRow.update(op.utilization ?? null, op.resets_at);

        // Extra usage — only show when enabled
        const showExtra = eu?.is_enabled && eu?.utilization != null;
        this._extraRow.visible = !!showExtra;
        if (showExtra) {
            this._extraRow.update(eu.utilization, null);
            if (eu.used_credits != null && eu.monthly_limit != null)
                this._extraRow._resetLabel.text = `$${Number(eu.used_credits).toFixed(2)} / $${Number(eu.monthly_limit).toFixed(2)}`;
        }

        // Panel label: only visible metrics
        const segments = [];
        const visiblePcts = [];
        if (this._settings.get_boolean('show-session')) {
            segments.push(`${fh ? Math.round(fh.utilization) : '?'}%`);
            if (fh) visiblePcts.push(fh.utilization);
        }
        if (this._settings.get_boolean('show-weekly')) {
            segments.push(`${sd ? Math.round(sd.utilization) : '?'}%`);
            if (sd) visiblePcts.push(sd.utilization);
        }
        if (this._settings.get_boolean('show-sonnet')) {
            segments.push(`${sn ? Math.round(sn.utilization) : '?'}%`);
            if (sn) visiblePcts.push(sn.utilization);
        }
        if (this._settings.get_boolean('show-opus') && op) {
            segments.push(`${Math.round(op.utilization)}%`);
            visiblePcts.push(op.utilization);
        }
        this._panelLabel.text = segments.length > 0 ? segments.join(' · ') : '—';

        // Colour the panel text when any visible bucket is high
        const maxPct = visiblePcts.length > 0 ? Math.max(...visiblePcts) : 0;
        const warn = this._settings.get_int('warn-threshold');
        const crit = this._settings.get_int('crit-threshold');
        if (maxPct >= crit)
            this._panelLabel.set_style(`color: ${this._settings.get_string('color-crit')};`);
        else if (maxPct >= warn)
            this._panelLabel.set_style(`color: ${this._settings.get_string('color-warn')};`);
        else
            this._panelLabel.set_style('');

        const now = GLib.DateTime.new_now_local();
        this._refreshItem.label.text = `↻  Refresh  ·  ${now.format('%l:%M %p').trim()}`;
    }

    _setError(msg, soft = false) {
        if (!soft)
            this._panelLabel.text = '⚠';
        this._refreshItem.label.text = `↻  Refresh  ·  ${msg}`;
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
