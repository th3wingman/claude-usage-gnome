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
    }
}
