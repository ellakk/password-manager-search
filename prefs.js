/*jshint esversion: 6 */

const GdkPixbuf = imports.gi.GdkPixbuf;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const SCHEMA_PATH = "/org/gnome/shell/extensions/password-manager-search/";
const GSET = "gnome-shell-extension-tool";

const Settings = new Lang.Class({
  Name: "PasswordManagerSearch.Settings",

  _init: function() {
    this._settings = Convenience.getSettings(
      "org.gnome.shell.extensions.password-manager-search"
    );

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
  _connector: function(builder, object, signal, handler) {
    object.connect(signal, Lang.bind(this, this._SignalHandler[handler]));
  },

  _update_set_password_label: function() {
    let set_password_label = this._builder.get_object(
      "password_manager_password_label"
    );
    let manager = this._settings.get_string("manager");

    switch (manager) {
      case "NONE":
        set_password_label.set_text("Set password for");
        break;
      case "LASTPASS":
        set_password_label.set_text("Set password for LastPass");
        break;
      case "1PASSWORD":
        set_password_label.set_text("Set password for 1Password");
        break;
      case "BITWARDEN":
        set_password_label.set_text("Set password for 1Password");
        break;
    }
  },

  _bindSettings: function() {
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

    this._update_set_password_label();

    if (manager === "NONE") {
      this._builder
        .get_object("password_manager_listboxrow1")
        .set_sensitive(false);
      this._builder
        .get_object("password_manager_password_label")
        .set_text(`Set password for ${manager}`);
    }
  },

  _update_save_button: function() {
    let username = this._builder
      .get_object("password_manager_password_user_entry")
      .get_text();
    let password = this._builder
      .get_object("password_manager_password_password_entry")
      .get_text();

    let button = this._builder.get_object(
      "password_manager_password_save_button"
    );

    if (username.length > 0 && password.length > 0) {
      button.set_sensitive(true);
    } else {
      button.set_sensitive(false);
    }
  },

  _SignalHandler: {
    password_manager_password_user_entry_changed_cb: function(button) {
      this._update_save_button();
    },

    password_manager_password_password_entry_changed_cb: function(button) {
      this._update_save_button();
    },

    password_manager_password_save_button_clicked_cb: function(button) {},

    password_manager_none_button_toggled_cb: function(button) {
      if (button.get_active()) this._settings.set_string("manager", "NONE");
    },

    password_manager_lastpass_button_toggled_cb: function(button) {
      if (button.get_active()) this._settings.set_string("manager", "LASTPASS");
    },

    password_manager_1password_button_toggled_cb: function(button) {
      if (button.get_active())
        this._settings.set_string("manager", "1PASSWORD");
    },

    password_manager_bitwarden_button_toggled_cb: function(button) {
      if (button.get_active())
        this._settings.set_string("manager", "BITWARDEN");
    }
  }
});

function init() {}

function buildPrefsWidget() {
  let settings = new Settings();
  let widget = settings.widget;

  // I'd like the scrolled window to default to a size large enough to show all without scrolling, if it fits on the screen
  // But, it doesn't seem possible, so I'm setting a minimum size if there seems to be enough screen real estate
  widget.show_all();

  return widget;
}
