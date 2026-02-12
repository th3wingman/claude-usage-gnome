import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ClaudeUsagePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: 'Polling',
            description: 'How often the extension checks your Claude usage',
        });
        page.add(group);

        const row = Adw.SpinRow.new_with_range(30, 3600, 30);
        row.set_title('Refresh interval');
        row.set_subtitle('Seconds between API polls (30\u20133600)');
        row.get_adjustment().set_page_increment(60);
        group.add(row);

        settings.bind(
            'refresh-interval',
            row,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        // ── Panel Display ───────────────────────────────────────────────
        const displayGroup = new Adw.PreferencesGroup({
            title: 'Panel Display',
            description: 'Choose which metrics appear in the panel label',
        });
        page.add(displayGroup);

        const showSessionRow = new Adw.SwitchRow({
            title: 'Session (5h)',
            subtitle: 'Show session usage in panel',
        });
        settings.bind('show-session', showSessionRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        displayGroup.add(showSessionRow);

        const showWeeklyRow = new Adw.SwitchRow({
            title: 'Weekly (all models)',
            subtitle: 'Show weekly usage in panel',
        });
        settings.bind('show-weekly', showWeeklyRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        displayGroup.add(showWeeklyRow);

        const showSonnetRow = new Adw.SwitchRow({
            title: 'Weekly (Sonnet)',
            subtitle: 'Show Sonnet usage in panel',
        });
        settings.bind('show-sonnet', showSonnetRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        displayGroup.add(showSonnetRow);

        // ── Appearance ──────────────────────────────────────────────────
        const appearanceGroup = new Adw.PreferencesGroup({
            title: 'Appearance',
            description: 'Color thresholds and colors for usage bars and panel text',
        });
        page.add(appearanceGroup);

        // Warn threshold
        const warnRow = Adw.SpinRow.new_with_range(1, 99, 1);
        warnRow.set_title('Warning threshold');
        warnRow.set_subtitle('Usage % at which bars turn warning color');
        appearanceGroup.add(warnRow);
        settings.bind('warn-threshold', warnRow, 'value', Gio.SettingsBindFlags.DEFAULT);

        // Crit threshold
        const critRow = Adw.SpinRow.new_with_range(1, 99, 1);
        critRow.set_title('Critical threshold');
        critRow.set_subtitle('Usage % at which bars turn critical color');
        appearanceGroup.add(critRow);
        settings.bind('crit-threshold', critRow, 'value', Gio.SettingsBindFlags.DEFAULT);

        // Color OK
        const colorOkRow = new Adw.EntryRow({title: 'OK color (hex)'});
        colorOkRow.set_text(settings.get_string('color-ok'));
        colorOkRow.connect('changed', () => {
            settings.set_string('color-ok', colorOkRow.get_text());
        });
        settings.connect('changed::color-ok', () => {
            if (colorOkRow.get_text() !== settings.get_string('color-ok'))
                colorOkRow.set_text(settings.get_string('color-ok'));
        });
        appearanceGroup.add(colorOkRow);

        // Color Warn
        const colorWarnRow = new Adw.EntryRow({title: 'Warning color (hex)'});
        colorWarnRow.set_text(settings.get_string('color-warn'));
        colorWarnRow.connect('changed', () => {
            settings.set_string('color-warn', colorWarnRow.get_text());
        });
        settings.connect('changed::color-warn', () => {
            if (colorWarnRow.get_text() !== settings.get_string('color-warn'))
                colorWarnRow.set_text(settings.get_string('color-warn'));
        });
        appearanceGroup.add(colorWarnRow);

        // Color Crit
        const colorCritRow = new Adw.EntryRow({title: 'Critical color (hex)'});
        colorCritRow.set_text(settings.get_string('color-crit'));
        colorCritRow.connect('changed', () => {
            settings.set_string('color-crit', colorCritRow.get_text());
        });
        settings.connect('changed::color-crit', () => {
            if (colorCritRow.get_text() !== settings.get_string('color-crit'))
                colorCritRow.set_text(settings.get_string('color-crit'));
        });
        appearanceGroup.add(colorCritRow);
    }
}
