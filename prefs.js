const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const CredentialsManager = Me.imports.credentialsManager.CredentialsManager;
const PasswordManagers = Me.imports.passwordManagers;

class Settings {
    constructor() {
        this._credentialsManager = new CredentialsManager();
        this._settings = Convenience.getSettings();

        this._builder = new Gtk.Builder();
        this._builder.add_from_file(`${Me.path}/prefs.ui`);

        this._gtkbox = this._builder.get_object('settings');
        this._viewport = new Gtk.Viewport();
        this._viewport.add(this._gtkbox);
        this.widget = new Gtk.ScrolledWindow();
        this.widget.add(this._viewport);

        this.widget.connect('realize', () => {
            const window = this.widget.get_toplevel();
            window.resize(750, 400);
        });

        this._updateStartupSettings();
        this._builder.connect_signals_full(this._connector.bind(this));
    }

    _connector(builder, object, signal, handler) {
        const signalHandler = {
            password_manager_none_button_toggled_cb(button) {
                if (button.get_active())
                    this._settings.set_string('manager', 'NONE');

                this._updateSettings();
            },
            password_manager_lastpass_button_toggled_cb(button) {
                if (button.get_active())
                    this._settings.set_string('manager', 'LASTPASS');

                this._updateSettings();
            },
            password_manager_1password_button_toggled_cb(button) {
                if (button.get_active())
                    this._settings.set_string('manager', '1PASSWORD');

                this._updateSettings();
            },
            password_manager_bitwarden_button_toggled_cb(button) {
                if (button.get_active())
                    this._settings.set_string('manager', 'BITWARDEN');

                this._updateSettings();
            },
            password_manager_test_button_clicked_cb(_button) {
                let passwordManager;
                switch (this._settings.get_string('manager')) {
                case 'LASTPASS':
                    passwordManager = new PasswordManagers.LastPass();
                    break;
                case '1PASSWORD':
                    passwordManager = new PasswordManagers.OnePassword();
                    break;
                case 'BITWARDEN':
                    passwordManager = new PasswordManagers.Bitwarden();
                    break;
                }

                let testMessage = passwordManager.test();
                Convenience.sendNotification(
                    `Test login for ${passwordManager.manager}`,
                    testMessage,
                );
            },
        };
        object.connect(signal, signalHandler[handler].bind(this));
    }

    _updateStartupSettings() {
        const manager = this._settings.get_string('manager');

        switch (manager) {
        case 'NONE':
            this._builder
                    .get_object('password_manager_none_button')
                    .set_active(true);
            break;
        case 'LASTPASS':
            this._builder
                    .get_object('password_manager_lastpass_button')
                    .set_active(true);
            break;
        case '1PASSWORD':
            this._builder
                    .get_object('password_manager_1password_button')
                    .set_active(true);
            break;
        case 'BITWARDEN':
            this._builder
                    .get_object('password_manager_bitwarden_button')
                    .set_active(true);
            break;
        }

        this._updateSettings();
    }

    _updateSettings() {
        const manager = this._settings.get_string('manager');
        const settingButton = this._builder.get_object(
            'password_manager_settings_button',
        );
        const testButton = this._builder.get_object(
            'password_manager_test_button',
        );

        switch (manager) {
        case 'NONE':
            settingButton.set_sensitive(false);
            testButton.set_sensitive(false);
            break;
        case 'LASTPASS':
            settingButton.set_sensitive(true);
            testButton.set_sensitive(true);
            break;
        case '1PASSWORD':
            settingButton.set_sensitive(true);
            testButton.set_sensitive(true);
            break;
        case 'BITWARDEN':
            settingButton.set_sensitive(true);
            testButton.set_sensitive(true);
            break;
        }
    }
}

function init() {}

function buildPrefsWidget() {
    const settings = new Settings();
    const widget = settings.widget;
    widget.show_all();
    settings._updateSettings();
    return widget;
}
