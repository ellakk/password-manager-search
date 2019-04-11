/* global imports */

const ByteArray = imports.byteArray
const Clutter = imports.gi.Clutter
const GLib = imports.gi.GLib
const Gio = imports.gi.Gio
const Gtk = imports.gi.Gtk
const Main = imports.ui.main
const St = imports.gi.St
const Util = imports.misc.util

const Extension = imports.misc.extensionUtils.getCurrentExtension()

/**
 * Class for interacting with LastPass client
 *
 * @class
 */
class LastPassClient {
  constructor () {
    this.accounts = []
  }

  /**
   * Returns a list of account names
   * @returns {string[]} - List of account names
   */
  getAccountNames () {
    return this.accounts.map(account => account.name)
  }

  /**
   * Update account list by calling the LastPass client
   */
  refreshAccounts () {
    let resp = GLib.spawn_command_line_sync(
      'lpass ls --format "[%an] [%al]"'
    )
    let respLines = ByteArray.toString(resp[1]).split('\n')
    let accounts = []
    for (var i = 0; i < respLines.length; i++) {
      let match = respLines[i].match(/\[(.+)\]\s\[(.+)\]/)
      if (match) {
        accounts.push({ name: match[1], url: match[2] })
      }
    }
    this.accounts = accounts
  }

  /**
   * Save account password to clipboard by calling the LastPass client
   * @param {string} account
   */
  savePasswordToClipboard (account) {
    Util.spawn(['lpass', 'show', '-c', '--password', account])
  }
  /**
   * Save account username to clipboard by calling the LastPass client
   * @param {string} account
   */
  saveUsernameToClipboard (account) {
    Util.spawn(['lpass', 'show', '-c', '--username', account])
  }
}

/**
 * Class
 *
 * @class
 */
class LastPassSearchProvider {
  constructor () {
    // Add our icon dir to search path
    Gtk.IconTheme.get_default().append_search_path(
      Extension.dir.get_child('icons').get_path()
    )

    // Use the default app for opening https links as the app for
    // launching full search.
    this.appInfo = Gio.AppInfo.get_default_for_uri_scheme('https')
    // Fake the name and icon of the app
    this.appInfo.get_name = () => {
      return 'LastPass Search Provider'
    }
    this.appInfo.get_icon = () => {
      return new Gio.ThemedIcon({ name: 'lastpass' })
    }
    this.lastpass = new LastPassClient()
    this.lastPrefix = ''
  }

  /**
   * Called by GS when an result is choosen in the overview.
   * Save the selected result to clipboard
   */
  activateResult (id, terms, timestamp) {
    if (this.lastPrefix === 'p') {
      this.lastpass.savePasswordToClipboard(id)
    } else {
      this.lastpass.saveUsernameToClipboard(id)
    }
  }

  createIcon (size) {
    let box = new Clutter.Box()
    let icon = new St.Icon({
      gicon: new Gio.ThemedIcon({ name: 'lastpass' }),
      icon_size: size
    })
    box.add_child(icon)
    return box
  }

  filterResults (results, max) {
    return results.slice(0, max)
  }

  getInitialResultSet (terms, callback, cancellable) {
    this.lastpass.refreshAccounts()
    this.getResult(terms, callback)
  }

  getResult (terms, callback) {
    this.lastPrefix = terms.shift()
    let term = terms.join(' ')
    let results = []
    if (this.lastPrefix === 'p' || this.lastPrefix === 'l') {
      let accounts = this.lastpass.getAccountNames()
      let regExp = new RegExp(term, 'i')
      results = accounts.filter(account => regExp.test(account))
    }
    callback(results)
  }

  getResultMetas (ids, callback) {
    let metas = []

    for (let i = 0; i < ids.length; i++) {
      metas.push({ id: ids[i], name: ids[i], createIcon: this.createIcon })
    }
    callback(metas)
  }

  getSubsearchResultSet (results, terms, callback, cancelable) {
    this.getResult(terms, callback)
  }
}

let lastPassSearchProvider = null

function init (meta) {}

function enable () {
  if (!lastPassSearchProvider) {
    lastPassSearchProvider = new LastPassSearchProvider()
    Main.overview.viewSelector._searchResults._registerProvider(
      lastPassSearchProvider
    )
  }
}

function disable () {
  if (lastPassSearchProvider) {
    Main.overview.viewSelector._searchResults._unregisterProvider(
      lastPassSearchProvider
    )
    lastPassSearchProvider = null
  }
  global.log('nej')
}
