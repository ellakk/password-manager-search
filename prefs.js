const Gtk = imports.gi.Gtk

const Me = imports.misc.extensionUtils.getCurrentExtension()
const Convenience = Me.imports.convenience
const CredentialsManager = Me.imports.credentialsManager.CredentialsManager

class Settings {
  constructor () {
    this._credentialsManager = new CredentialsManager()
    this._settings = Convenience.getSettings()

    this._builder = new Gtk.Builder()
    this._builder.add_from_file(Me.path + '/prefs.ui')

    this._gtkbox = this._builder.get_object('settings')
    this._viewport = new Gtk.Viewport()
    this._viewport.add(this._gtkbox)
    this.widget = new Gtk.ScrolledWindow()
    this.widget.add(this._viewport)

    this.widget.connect('realize', () => {
      const window = this.widget.get_toplevel()
      window.resize(750, 400)
    })

    this._updateStartupSettings()
    this._builder.connect_signals_full(this._connector.bind(this))
  }

  /**
   * Connect signals
   */
  _connector (builder, object, signal, handler) {
    const signalHandler = {
      password_manager_password_user_entry_changed_cb (_) {
        this._updateSaveButton()
      },
      password_manager_password_password_entry_changed_cb (_) {
        this._updateSaveButton()
      },
      password_manager_password_save_button_clicked_cb (button) {
        const username = this._builder.get_object(
          'password_manager_password_user_entry'
        )
        const password = this._builder.get_object(
          'password_manager_password_password_entry'
        )
        const manager = this._settings.get_string('manager')

        this._credentialsManager.setCredential(
          manager,
          username.get_text(),
          password.get_text()
        )

        username.set_text('')
        password.set_text('')
        button.set_sensitive(false)
      },
      password_manager_none_button_toggled_cb (button) {
        if (button.get_active()) {
          this._settings.set_string('manager', 'NONE')
        }
        this._updateSetPasswordBox()
      },
      password_manager_lastpass_button_toggled_cb (button) {
        if (button.get_active()) {
          this._settings.set_string('manager', 'LASTPASS')
        }
        this._updateSetPasswordBox()
      },
      password_manager_1password_button_toggled_cb (button) {
        if (button.get_active()) {
          this._settings.set_string('manager', '1PASSWORD')
        }
        this._updateSetPasswordBox()
      },
      password_manager_bitwarden_button_toggled_cb (button) {
        if (button.get_active()) {
          this._settings.set_string('manager', 'BITWARDEN')
        }
        this._updateSetPasswordBox()
      }
    }
    object.connect(signal, signalHandler[handler].bind(this))
  }

  _updateStartupSettings () {
    const manager = this._settings.get_string('manager')

    switch (manager) {
      case 'NONE':
        this._builder
          .get_object('password_manager_none_button')
          .set_active(true)
        break
      case 'LASTPASS':
        this._builder
          .get_object('password_manager_lastpass_button')
          .set_active(true)
        break
      case '1PASSWORD':
        this._builder
          .get_object('password_manager_1password_button')
          .set_active(true)
        break
      case 'BITWARDEN':
        this._builder
          .get_object('password_manager_bitwarden_button')
          .set_active(true)
        break
    }

    this._updateSetPasswordBox()
  }

  _updateSetPasswordBox () {
    const manager = this._settings.get_string('manager')
    const passwordbox = this._builder.get_object('password_manager_listboxrow1')
    const set_password_label = this._builder.get_object(
      'password_manager_password_label'
    )

    switch (manager) {
      case 'NONE':
        set_password_label.set_text('Set password for')
        passwordbox.set_sensitive(false)
        break
      case 'LASTPASS':
        set_password_label.set_text('Set password for LastPass')
        passwordbox.set_sensitive(true)
        break
      case '1PASSWORD':
        set_password_label.set_text('Set password for 1Password')
        passwordbox.set_sensitive(true)
        break
      case 'BITWARDEN':
        set_password_label.set_text('Set password for 1Password')
        passwordbox.set_sensitive(true)
        break
    }
  }

  _updateSaveButton () {
    const username = this._builder
      .get_object('password_manager_password_user_entry')
      .get_text()
    const password = this._builder
      .get_object('password_manager_password_password_entry')
      .get_text()

    const save_button = this._builder.get_object(
      'password_manager_password_save_button'
    )

    if (username.length > 0 && password.length > 0) {
      save_button.set_sensitive(true)
    } else {
      save_button.set_sensitive(false)
    }
  }
}

function init () {}

function buildPrefsWidget () {
  const settings = new Settings()
  const widget = settings.widget

  widget.show_all()
  return widget
}
