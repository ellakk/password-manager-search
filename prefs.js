const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const Settings = new Lang.Class({
  Name: "PasswordManagerSearch.Settings",

  _init() {
    this._settings = Convenience.getSettings();

    this._rtl = Gtk.Widget.get_default_direction() == Gtk.TextDirection.RTL;

    this._builder = new Gtk.Builder();
    this._builder.add_from_file(Me.path + "/prefs.ui");

    this.gtkbox = this._builder.get_object("settings");
    this.viewport = new Gtk.Viewport();
    this.viewport.add(this.gtkbox);
    this.widget = new Gtk.ScrolledWindow();
    this.widget.add(this.viewport);

    this._bindSettings();

    this._builder.connect_signals_full(Lang.bind(this, this._connector));
  },

  /**
   * Connect signals
   */
  _connector(builder, object, signal, handler) {
    object.connect(signal, Lang.bind(this, this._signalHandler[handler]));
  },

  _bindSettings() {
    let manager = this._settings.get_string("manager");

    switch (manager) {
      case "NONE":
        this._builder
          .get_object("password_manager_none_button")
          .set_active(true);
        break;
      case "LASTPASS":
        this._builder
          .get_object("password_manager_lastpass_button")
          .set_active(true);
        break;
      case "1PASSWORD":
        this._builder
          .get_object("password_manager_1password_button")
          .set_active(true);
        break;
      case "BITWARDEN":
        this._builder
          .get_object("password_manager_bitwarden_button")
          .set_active(true);
        break;
    }

    this._updateSetPasswordBox();
  },

  _updateSetPasswordBox() {
    let manager = this._settings.get_string("manager");
    let passwordbox = this._builder.get_object("password_manager_listboxrow1");
    let set_password_label = this._builder.get_object(
      "password_manager_password_label"
    );

    switch (manager) {
      case "NONE":
        set_password_label.set_text("Set password for");
        passwordbox.set_sensitive(false);
        break;
      case "LASTPASS":
        set_password_label.set_text("Set password for LastPass");
        passwordbox.set_sensitive(true);
        break;
      case "1PASSWORD":
        set_password_label.set_text("Set password for 1Password");
        passwordbox.set_sensitive(true);
        break;
      case "BITWARDEN":
        set_password_label.set_text("Set password for 1Password");
        passwordbox.set_sensitive(true);
        break;
    }
  },

  _updateSaveButton() {
    let username = this._builder
      .get_object("password_manager_password_user_entry")
      .get_text();
    let password = this._builder
      .get_object("password_manager_password_password_entry")
      .get_text();

    let save_button = this._builder.get_object(
      "password_manager_password_save_button"
    );

    if (username.length > 0 && password.length > 0) {
      save_button.set_sensitive(true);
    } else {
      save_button.set_sensitive(false);
    }
  },

  _signalHandler: {
    password_manager_password_user_entry_changed_cb(_) {
      this._updateSaveButton();
    },

    password_manager_password_password_entry_changed_cb(_) {
      this._updateSaveButton();
    },

    password_manager_password_save_button_clicked_cb(button) {
      let username = this._builder.get_object(
        "password_manager_password_user_entry"
      );
      let password = this._builder.get_object(
        "password_manager_password_password_entry"
      );
      let manager = this._settings.get_string("manager");

      Convenience.setLogin(manager, username.get_text(), password.get_text());

      username.set_text("");
      password.set_text("");
      button.set_sensitive(false);
    },

    password_manager_none_button_toggled_cb(button) {
      if (button.get_active()) this._settings.set_string("manager", "NONE");
      this._updateSetPasswordBox();
    },

    password_manager_lastpass_button_toggled_cb(button) {
      if (button.get_active()) this._settings.set_string("manager", "LASTPASS");
      this._updateSetPasswordBox();
    },

    password_manager_1password_button_toggled_cb(button) {
      if (button.get_active())
        this._settings.set_string("manager", "1PASSWORD");
      this._updateSetPasswordBox();
    },

    password_manager_bitwarden_button_toggled_cb(button) {
      if (button.get_active())
        this._settings.set_string("manager", "BITWARDEN");
      this._updateSetPasswordBox();
    }
  }
});

function init() {
}

function buildPrefsWidget() {
  let settings = new Settings();
  let widget = settings.widget;

  // I'd like the scrolled window to default to a size large enough to show all without scrolling, if it fits on the screen
  // But, it doesn't seem possible, so I'm setting a minimum size if there seems to be enough screen real estate
  widget.show_all();

  return widget;
}
