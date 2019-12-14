const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Util = imports.misc.util;


const Me = imports.misc.extensionUtils.getCurrentExtension();
const PasswordManagers = Me.imports.passwordManagers;
const Convenience = Me.imports.convenience;

var PasswordManagerSearchProvider = class PMSPasswordManagerSearchProvider {
    constructor() {
        this._clipboard = St.Clipboard.get_default();
        this._settings = Convenience.getSettings();
        // Convert to millisecounds
        this._sync_interval = 5 * 60000;
        // Add one millisecound to force sync
        this._lastSync = new Date().valueOf() - (this._sync_interval + 1);
        this._currentPrefix = '';
        this._prefixUsername = 'u';
        this._prefixPassword = 'p';

        switch (this._settings.get_string('manager')) {
        case 'LASTPASS':
            this._passwordManager = new PasswordManagers.LastPass();
            break;
        case '1PASSWORD':
            this._passwordManager = new PasswordManagers.OnePassword();
            break;
        case 'BITWARDEN':
            this._passwordManager = new PasswordManagers.Bitwarden();
            break;
        }

        // application info
        this.appInfo = Gio.AppInfo.get_default_for_uri_scheme('https');
        this.appInfo.get_name = () => {
            return 'Password Manager Search Provider';
        };
        this.appInfo.get_icon = () => {
            return new Gio.ThemedIcon({ name: 'dialog-password' });
        };
    }

    /**
     * Called by GS when an result is choosen in the overview.
     * Save the selected result to clipboard.
     * @param {string} id - Identity of the selected item.
     * @param {[string]} _terms - The search string split by space.
     * @param {string} _timestamp - Time when called.
     */
    activateResult(id, _terms, _timestamp) {
        var item = '';
        if (this._currentPrefix === this._prefixUsername)
            item = this._passwordManager.getAccountUsername(id);
        else
            item = this._passwordManager.getAccountPassword(id);

        Util.spawn(['/bin/bash', '-c', `echo -n "${item}" | xclip -selection clipboard`]);
        // this._clipboard.set_text(St.ClipboardType.CLIPBOARD, item);
    }

    /**
     * Called by GS to limit the amount of results it shows.
     * @param {[string]} results - results
     * @param {int} max - maximum amount of results it expects to get back.
     * @returns {[string]} - Results to be displayed.
     */
    filterResults(results, max) {
        return results.slice(0, max);
    }

    /**
     * Called by GS when a new search is started.
     * @param {[string]} terms - The search string split by space.
     * @param {callable} callback - Function that handles the results.
     * @param {bool} _cancellable - If the search can be cancelled?.
     */
    getInitialResultSet(terms, callback, _cancellable) {
        this.getResult(terms, callback);
    }

    /**
     * Called by getResults and getSubsearchResultSet. Sets results for seaches.
     * @param {[string]} terms - The search string split by space.
     * @param {callable} callback - Function that handles the results.
     */
    getResult(terms, callback) {
        let fullSearch = terms.join(' ');
        let fullTerm = '';
        let results = [];
        this._currentPrefix = '';

        if (fullSearch.startsWith(`${this._prefixUsername} `)) {
            this._currentPrefix = this._prefixUsername;
            fullTerm = fullSearch.substring(this._prefixUsername.length + 1);
        }

        if (fullSearch.startsWith(`${this._prefixPassword} `)) {
            this._currentPrefix = this._prefixPassword;
            fullTerm = fullSearch.substring(this._prefixPassword.length + 1);
        }

        if (this._currentPrefix) {
            this._mabySync();
            let accounts = this._passwordManager.getAccountNames();
            let regExp = new RegExp(fullTerm, 'i');
            results = accounts.filter(account => regExp.test(account));
        }

        callback(results);
    }

    /**
     * Called by GS to obtain information about the search results.
     * @param {[string]} ids - Search ids.
     * @param {callable} callback - Function that handles the resulting
     * information.
     */
    getResultMetas(ids, callback) {
        const metas = [];

        for (let i = 0; i < ids.length; i++)
            metas.push({ id: ids[i], name: ids[i], createIcon: this._createIcon });

        callback(metas);
    }

    /**
     * Called by GS to refine the initial search results whe nthe user types
     * more characters in the search entry.
     * @param {[string]} _results - Current results.
     * @param {[string]} terms - The search string split by space.
     * @param {callable} callback - Function that handles the results.
     * @param {bool} _cancellable - If the search can be cancelled?.
     */
    getSubsearchResultSet(_results, terms, callback, _cancellable) {
        this.getResult(terms, callback);
    }

    /**
     * Used in getResultMetas callback to create icons for the entries.
     * @param {int} size - Size of icon.
     * @returns {Box} - Container containing the created icon.
     */
    _createIcon(size) {
        const box = new Clutter.Box();
        const icon = new St.Icon({
            gicon: new Gio.ThemedIcon({ name: 'dialog-password' }),
            icon_size: size,
        });
        box.add_child(icon);
        return box;
    }

    /**
     * Syncs password manager if not synced or if sync intervall is reached.
     */
    _mabySync() {
        let diff = new Date().valueOf() - this._lastSync;
        if (diff > this._sync_interval) {
            this._passwordManager.sync();
            this._lastSync = new Date().valueOf();
        }

    }
};
