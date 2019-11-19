// const Me = imports.misc.extensionUtils.getCurrentExtension();
// const CredentialsManager = imports.credentialsManager.CredentialsManager;
const Secret = imports.gi.Secret;
const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;

var CredentialsManager = class PMSCredentialsManager {
    constructor() {
        this.schema = new Secret.Schema(
            'org.gnome.shell.extensions.password-manager-search',
            Secret.SchemaFlags.NONE,
            {
                name: Secret.SchemaAttributeType.STRING,
            },
        );
    }

    _getCredentials() {
        const credentials = Secret.password_lookup_sync(
            this.schema,
            { name: 'password-manager-search' },
            null,
        );
        if (credentials === null)
            return {};

        return JSON.parse(credentials);
    }

    _delCredentials() {
        Secret.password_clear_sync(
            this.schema,
            { name: 'password-manager-search' },
            null,
        );
    }

    getCredential(site) {
        const credentials = this._getCredentials();

        if (site in credentials)
            return credentials[site];

        return null;
    }

    setCredential(site, username, password) {
        const credentials = this._getCredentials();

        credentials[site] = { username, password };

        this._delCredentials();
        Secret.password_store_sync(
            this.schema,
            { name: 'password-manager-search' },
            Secret.COLLECTION_DEFAULT,
            'JSON credentials for password managers',
            JSON.stringify(credentials),
            null,
        );
    }
};

/**
 * Abstract class that should be implemented by the different passwordmanagers.
 */
class PasswordManager {
    constructor(manager) {
        this.manager = manager;
        const credentialsManager = new CredentialsManager();
        this._accounts = [];
        this._credentials = {
            username: () => credentialsManager.getCredential(manager).username,
            password: () => credentialsManager.getCredential(manager).password,
        };
        if (this.constructor === PasswordManager) {
            throw new TypeError(
                'Abstract class "PasswordManager" cannot be instantiated directly.',
            );
        }
    }

    /**
   * Send a shell command and get response.
   * @param {string} cmd - Command to run in shell.
   * @return {[bool, string]} A string with the response and a bool that's true
   * when response code is not 0.
   */
    _sendShellCommand(cmd) {
        let [_, out, err, status] = GLib.spawn_command_line_sync(cmd);
        out = ByteArray.toString(out);
        err = ByteArray.toString(err);

        if (status !== 0) {
            if (err && out)
                return [false, `${err}\n${out}`];
            else if (err)
                return [false, err];
            else
                return [false, out];

        }

        return [true, out];
    }

    /**
   * Get the password of account as a string.
   * @param {string} _account - Name of the account.
   */
    getPassword(_account) {
        throw new TypeError(
            'Abstract method called from child. This method has to be implemented in child.',
        );
    }

    /**
   * Get the username of account as a string.
   * @param {string} _account - Name of the account.
   */
    getUsername(_account) {
        throw new TypeError(
            'Abstract method called from child. This method has to be implemented in child.',
        );
    }

    /**
   * Update password manager data.
   */
    refresh() {
        throw new TypeError(
            'Abstract method called from child. This method has to be implemented in child.',
        );
    }

    /**
   * Get a all accounts as a list of strings stored in the password manager.
   */
    getAccounts() {
        throw new TypeError(
            'Abstract method called from child. This method has to be implemented in child.',
        );
    }
}

class LastPass extends PasswordManager {
    constructor() {
        super('LASTPASS');
    }

    /**
   * Login to LastPass.
   * @return {bool} true if the loggin command was succesful.
   */
    _login() {
    // We have to send the command via /bin/bash because just sending the actual
    // login command won't work because GLib.spawn_command_line_sync does not
    // allowed piped command.
        let [suc, _] = this._sendShellCommand(
            `/bin/bash -c "echo '${this._credentials.password()}' | lpass login ${this._credentials.username()}"`,
        );
        return suc;
    }
}

const lp = new LastPass();
lp._login();
