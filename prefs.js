const Gtk = imports.gi.Gtk;

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
            window.resize(950, 400);
        });

        this._updateStartupSettings();
        this._builder.connect_signals_full(this._connector.bind(this));
    }

    _connector(builder, object, signal, handler) {
        const signalHandler = {
            // Main window widgets
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
            password_manager_settings_button_clicked_cb(_button) {
                let box, title;
                switch (this._settings.get_string('manager')) {
                case 'LASTPASS':
                    box = this._builder.get_object('box_lastpass');
                    title = 'LastPass';
                    break;
                case '1PASSWORD':
                    box = this._builder.get_object('box_1password');
                    title = '1Password';
                    break;
                case 'BITWARDEN':
                    box = this._builder.get_object('box_bitwarden');
                    title = 'Bitwarden';
                    break;
                }

                let dialog = new Gtk.Dialog({
                    title: `${title} settings`,
                    transient_for: this.widget.get_toplevel(),
                    use_header_bar: true,
                    modal: true,
                });

                dialog.get_content_area().add(box);
                dialog.connect('response', () => {
                    // remove the settings box so it doesn't get destroyed;
                    dialog.get_content_area().remove(box);
                    dialog.destroy();
                });
                dialog.show_all();
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

                let message = passwordManager.test();
                Convenience.sendNotification(
                    `Test login for ${passwordManager.manager}`,
                    message,
                );
            },
            clipboard_setter_native_button_toggled_cb(button) {
                if (button.get_active())
                    this._settings.set_string('clipboard-setter', 'NATIVE');
            },
            clipboard_setter_xsel_button_toggled_cb(button) {
                if (button.get_active())
                    this._settings.set_string('clipboard-setter', 'XSEL');
            },
            clipboard_setter_xclip_button_toggled_cb(button) {
                if (button.get_active())
                    this._settings.set_string('clipboard-setter', 'XCLIP');
            },
            prefix_username_entry_changed_cb(entry) {
                if (entry.get_text().length > 0)
                    this._settings.set_string('username-prefix', entry.get_text());
            },
            prefix_password_entry_changed_cb(entry) {
                if (entry.get_text().length > 0)
                    this._settings.set_string('password-prefix', entry.get_text());
            },
            sync_interval_entry_changed_cb(entry) {
                let interval = parseInt(entry.get_text());
                if (!isNaN(interval))
                    this._settings.set_int('sync-interval', interval);
            },
            // LastPass widgets
            entry_lastpass_username_changed_cb(_) {
                this._lastpassMabyEnableSave();
            },
            entry_lastpass_password_changed_cb(_) {
                this._lastpassMabyEnableSave();
            },
            button_lastpass_save_clicked_cb(_) {
                let usernameEntry = this._builder.get_object(
                    'entry_lastpass_username',
                );
                let passwordEntry = this._builder.get_object(
                    'entry_lastpass_password',
                );

                this._credentialsManager.setCredential('LASTPASS', {
                    username: usernameEntry.get_text(),
                    password: passwordEntry.get_text(),
                });
                usernameEntry.set_text('');
                passwordEntry.set_text('');
            },
            // Bitwarden widgets
            entry_bitwarden_username_changed_cb(_) {
                this._bitwardenMabyEnableSave();
            },
            entry_bitwarden_password_changed_cb(_) {
                this._bitwardenMabyEnableSave();
            },
            button_bitwarden_save_clicked_cb(_) {
                let usernameEntry = this._builder.get_object(
                    'entry_bitwarden_username',
                );
                let passwordEntry = this._builder.get_object(
                    'entry_bitwarden_password',
                );

                this._credentialsManager.setCredential('BITWARDEN', {
                    username: usernameEntry.get_text(),
                    password: passwordEntry.get_text(),
                });
                usernameEntry.set_text('');
                passwordEntry.set_text('');
            },
            // 1Password
            entry_1password_username_changed_cb(_) {
                this._1passwordMabyEnableSave();
            },
            entry_1password_password_changed_cb(_) {
                this._1passwordMabyEnableSave();
            },
            entry_1password_secret_key_changed_cb(_) {
                this._1passwordMabyEnableSave();
            },
            entry_1password_signin_address(_) {
                this._1passwordMabyEnableSave();
            },
            button_1password_save_clicked_cb(_) {
                let usernameEntry = this._builder.get_object(
                    'entry_1password_username',
                );
                let passwordEntry = this._builder.get_object(
                    'entry_1password_password',
                );
                let secretKeyEntry = this._builder.get_object(
                    'entry_1password_secret_key',
                );
                let signinAddressEntry = this._builder.get_object(
                    'entry_1password_signin_address',
                );

                this._credentialsManager.setCredential('1PASSWORD', {
                    username: usernameEntry.get_text(),
                    password: passwordEntry.get_text(),
                    secretKey: secretKeyEntry.get_text(),
                    signinAddress: signinAddressEntry.get_text() || 'https://my.1password.com',
                });
                usernameEntry.set_text('');
                passwordEntry.set_text('');
                secretKeyEntry.set_text('');
                signinAddressEntry.set_text('');
            },

        };
        object.connect(signal, signalHandler[handler].bind(this));
    }

    _1passwordMabyEnableSave() {
        let saveButton = this._builder.get_object('button_1password_save');
        let username = this._builder
            .get_object('entry_1password_username')
            .get_text();
        let password = this._builder
            .get_object('entry_1password_password')
            .get_text();
        let secretKey = this._builder
            .get_object('entry_1password_secret_key')
            .get_text();

        if (username.length > 0 && password.length > 0 && secretKey.length > 0)
            saveButton.set_sensitive(true);
        else
            saveButton.set_sensitive(false);

    }

    _bitwardenMabyEnableSave() {
        let saveButton = this._builder.get_object('button_bitwarden_save');
        let username = this._builder
            .get_object('entry_bitwarden_username')
            .get_text();
        let password = this._builder
            .get_object('entry_bitwarden_password')
            .get_text();
        if (username.length > 0 && password.length > 0)
            saveButton.set_sensitive(true);
        else
            saveButton.set_sensitive(false);
    }

    _lastpassMabyEnableSave() {
        let saveButton = this._builder.get_object('button_lastpass_save');
        let username = this._builder
            .get_object('entry_lastpass_username')
            .get_text();
        let password = this._builder
            .get_object('entry_lastpass_password')
            .get_text();
        if (username.length > 0 && password.length > 0)
            saveButton.set_sensitive(true);
        else
            saveButton.set_sensitive(false);
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

        const clipboardSetter = this._settings.get_string('clipboard-setter');
        switch (clipboardSetter) {
        case 'NATIVE':
            this._builder
                    .get_object('clipboard_setter_native_button')
                    .set_active(true);
            break;
        case 'XSEL':
            this._builder
                    .get_object('clipboard_setter_xsel_button')
                    .set_active(true);
            break;
        case 'XCLIP':
            this._builder
                    .get_object('clipboard_setter_xclip_button')
                    .set_active(true);
            break;
        }

        const usernamePrefix = this._settings.get_string('username-prefix');
        this._builder.get_object('prefix_username_entry').set_text(usernamePrefix);

        const passwordPrefix = this._settings.get_string('password-prefix');
        this._builder.get_object('prefix_password_entry').set_text(passwordPrefix);

        const syncInterval = this._settings.get_int('sync-interval');
        this._builder.get_object('sync_interval_entry').set_text(syncInterval.toString());

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
