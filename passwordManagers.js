const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const CredentialsManager = Me.imports.credentialsManager.CredentialsManager;

/**
 * Abstract class that should be implemented by the different passwordmanagers.
 */
class PasswordManager {
    constructor(manager) {
        this.manager = manager;
        this._credentialsManager = new CredentialsManager();
        this._accounts = [];
        this._credentials = {
            username: () => {
                let c = this._credentialsManager.getCredential(manager);
                if ('username' in c)
                    return c.username;
                return '';
            },
            password: () => {
                let c = this._credentialsManager.getCredential(manager);
                if ('password' in c)
                    return c.password;
                return '';
            },
        };
        if (this.constructor === PasswordManager) {
            throw new TypeError(
                'Abstract class "PasswordManager" cannot be instantiated directly.',
            );
        }
    }

    /**
     * Get a list of all accounts stored in the password manager.
     * @return {[string]} List of account names.
     */
    getAccountNames() {
        return this._accounts.map(account => account.name);
    }

    /**
     * Get password for site.
     * @param {string} name - Name of site.
     * @return {string} The password.
     */
    getAccountPassword(name) {
        let account;
        for (account of this._accounts) {
            if (account.name === name)
                return account.password;
        }

    }

    /**
     * Get username for site.
     * @param {string} name - Name of site.
     * @return {string} The username.
     */
    getAccountUsername(name) {
        let account;
        for (account of this._accounts) {
            if (account.name === name)
                return account.username;
        }

    }

    /**
     * Sync password manager data.
     */
    sync() {
        throw new TypeError(
            'Abstract method called from child. This method has to be implemented in child.',
        );
    }

    /**
     * Check if everything is working (settings, login etc)
     * Should be called by the pref manager.
     */
    test() {
        throw new TypeError(
            'Abstract method called from child. This method has to be implemented in child.',
        );
    }

    /**
     * Send a shell command and get response, trims trailing whitespace.
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

        return [true, out.trim()];
    }
}

/**
 * Class that implements the functionality needed for Password Manager Search
 * extension to use LastPass.
 */
var LastPass = class PMSLastPass extends PasswordManager {
    constructor() {
        super('LASTPASS');
    }

    /**
     * Login to LastPass if we are not already logged in.
     * @return {bool} true if we already are or if the login command was succesful.
     */
    _mabyLogin() {
        if (this._isLoggedIn())
            return true;

        let [suc, _] = this._login();
        return suc;
    }

    /**
     * Login to 1Password.
     * @return {[bool, string]} Boolean representing the success and message from the client.
     */
    _login() {
        // We have to send the command via bash because just sending the
        // actual login command won't work because GLib.spawn_command_line_sync
        // does not allow piped commands.
        let [suc, msg] = this._sendShellCommand(
            `bash -c "echo '${this._credentials.password()}' | LPASS_DISABLE_PINENTRY=1 lpass login ${this._credentials.username()}"`,
        );
        return [suc, msg];
    }

    /**
     * Check if we are logged in to the LastPass cli.
     * @return {bool} true if logged in.
     */
    _isLoggedIn() {
        let [suc, _] = this._sendShellCommand('lpass status');
        return suc;
    }

    /**
     * Send shell command. If the command fails, then check if we are logged in
     * to the LastPass client and if we are not, login and try again.
     * @param {string} cmd - The command.
     * @return {bool} True if the command returned no errors.
     */
    _sendShellCommandLastPass(cmd) {
        let [suc, resp] = this._sendShellCommand(cmd);
        if (!suc && this._mabyLogin())
            [suc, resp] = this._sendShellCommand(cmd);

        if (!suc)
            Convenience.eLog(`shell command failed: ${cmd}`);

        return [suc, resp];
    }

    /**
     * Sync the account data from the LastPass client.
     */
    sync() {
        let cmd = "lpass show -G '' --color=never --json --sync=auto -x";
        let [suc, resp] = this._sendShellCommandLastPass(cmd);

        if (suc) {
            this._accounts = JSON.parse(resp).filter(
                account => account.name && account.username && account.password,
            );
        }
    }

    /**
     * Check if settings and login is working.
     * @return {string} Ok if everything works, otherwise error message.
     */
    test() {
        if (this._credentials.username().length === 0)
            return 'Username needs to be set';

        if (this._credentials.password().length === 0)
            return 'Password needs to be set';

        let [suc, msg] = this._login();
        if (!suc)
            return `Could not login, got following error:\n${msg}`;

        return 'Ok';
    }
};

/**
 * Class that implements the functionality needed for Password Manager Search
 * extension to use Bitwarden.
 */
var Bitwarden = class PMSBitwarden extends PasswordManager {
    constructor() {
        super('BITWARDEN');
        this._sessionKey = '';
    }

    /**
     * Login to Bitwarden if we are not already logged in.
     * @return {bool} true if we already are or if the login command was succesful.
     */
    _mabyLogin() {
        let [loggedIn, msg] = this._isLoggedIn();

        if (loggedIn)
            return true;

        if (msg === 'You are not logged in.') {
            [loggedIn, msg] = this._sendShellCommand(
                `bw login ${this._credentials.username()} '${this._credentials.password()}' --raw`,
            );
        } else {
            [loggedIn, msg] = this._sendShellCommand(
                `bw unlock '${this._credentials.password()}' --raw`,
            );
        }

        if (loggedIn)
            this._sessionKey = msg;
        return loggedIn;
    }

    /**
     * Check if we are logged in to the Bitwarden cli.
     * @return {bool} true if logged in.
     */
    _isLoggedIn() {
        let suc_, resp;

        if (this._sessionKey) {
            [suc_, resp] = this._sendShellCommand(
                `bw sync --session ${this._sessionKey} --response`,
            );
        } else {
            [suc_, resp] = this._sendShellCommand('bw sync --response');
        }

        resp = JSON.parse(resp);

        return [resp.success, resp.message];
    }

    /**
     * Send shell command. If the command fails, then check if we are logged in
     * to the Bitwarden client and if we are not, login and try again.
     * @param {string} cmd - The command.
     * @return {bool} True if the command returned no errors.
     */
    _sendShellCommandBitwarden(cmd) {
        let [suc, resp] = this._sendShellCommand(
            `${cmd} --session ${this._sessionKey}`,
        );
        if (!suc && this._mabyLogin()) {
            [suc, resp] = this._sendShellCommand(
                `${cmd} --session ${this._sessionKey}`,
            );
        }

        if (!suc) {
            Convenience.eLog(
                `shell command failed: ${cmd} --session ${this._sessionKey}`,
            );
        }

        return [suc, resp];
    }

    /**
     * Sync the account data from the Bitwarden client.
     */
    sync() {
        let cmd = 'bw list items --response';
        let [suc, resp] = this._sendShellCommandBitwarden(cmd);

        if (suc) {
            let accounts = JSON.parse(resp).data.data.filter(
                account => account.type === 1,
            );
            this._accounts = accounts.map(account => ({
                name: account.name,
                username: account.login.username,
                password: account.login.password,
            }));
        }
    }

    /**
     * Check if settings and login is working.
     * @return {string} Ok if everything works, otherwise error message.
     */
    test() {
        if (this._credentials.username().length === 0)
            return 'Username needs to be set';

        if (this._credentials.password().length === 0)
            return 'Password needs to be set';

        let [loggedIn, msg] = this._isLoggedIn();

        if (loggedIn)
            return true;

        if (msg === 'You are not logged in.') {
            [loggedIn, msg] = this._sendShellCommand(
                `bw login ${this._credentials.username()} '${this._credentials.password()}' --raw`,
            );
        } else {
            [loggedIn, msg] = this._sendShellCommand(
                `bw unlock '${this._credentials.password()}' --raw`,
            );
        }
        if (!loggedIn)
            return `Could not login, got following error:\n${msg}`;

        return 'Ok';
    }
};

var OnePassword = class PMSOnePassword extends PasswordManager {
    constructor() {
        super('1PASSWORD');
        this._credentials.secretKey = () => {
            let c = this._credentialsManager.getCredential('1PASSWORD');
            if ('secretKey' in c)
                return c.secretKey;
            return '';
        };
        this._credentials.signinAddress = () => {
            let c = this._credentialsManager.getCredential('1PASSWORD');
            if ('signinAddress' in c)
                return c.signinAddress;
            return '';
        };
        this._sessionKey = '';
    }

    /**
     * Login to 1Password if we are not already logged in.
     * @return {bool} true if we already are or if the login command was succesful.
     */
    _mabyLogin() {
        // We have to send the command via bash because just sending the
        // actual login command won't work because GLib.spawn_command_line_sync
        // does not allow piped commands.
        if (this._isLoggedIn())
            return true;

        let [suc, msg_] = this._login();
        return suc;
    }

    /**
     * Login to 1Password.
     * @return {[bool, string]} Boolean representing the success and message from the client.
     */
    _login() {
        let [suc, msg] = this._sendShellCommand(
            `bash -c "echo '${this._credentials.password()}' | op signin ${this._credentials.signinAddress()} ${this._credentials.username()} ${this._credentials.secretKey()} --output=raw"`,
        );
        if (!suc && msg.includes("Set the OP_DEVICE")) {
            let [_, uuid] = this._sendShellCommand(`bash -c "head -c 16 /dev/urandom | base32 | tr -d = | tr '[:upper:]' '[:lower:]'"`);
            [suc, msg] = this._sendShellCommand(
                `bash -c "export OP_DEVICE=${uuid}; echo '${this._credentials.password()}' | op signin ${this._credentials.signinAddress()} ${this._credentials.username()} ${this._credentials.secretKey()} --output=raw"`,
            );
        }
        if (suc)
            this._sessionKey = msg;

        return [suc, msg];
    }

    /**
     * Check if we are logged in to the 1Password cli.
     * @return {bool} true if logged in.
     */
    _isLoggedIn() {
        if (this._sessionKey) {
            let [suc, _] = this._sendShellCommand(
                `op list items --session="${this._sessionKey}"`,
            );
            return suc;
        } else {
            return false;
        }
    }

    /**
     * Send shell command. If the command fails, then check if we are logged in
     * to the Bitwarden client and if we are not, login and try again.
     * @param {string} cmd - The command.
     * @return {bool} True if the command returned no errors.
     */
    _sendShellCommandBitwarden(cmd) {
        let [suc, resp] = this._sendShellCommand(
            `${cmd} --session="${this._sessionKey}"`,
        );
        if (!suc && this._mabyLogin()) {
            [suc, resp] = this._sendShellCommand(
                `${cmd} --session="${this._sessionKey}"`,
            );
        }

        if (!suc) {
            Convenience.eLog(
                `shell command failed: ${cmd} --session=${this._sessionKey}`,
            );
        }

        return [suc, resp];
    }

    /**
     * Check if settings and login is working.
     * @return {string} Ok if everything works, otherwise error message.
     */
    test() {
        if (this._credentials.signinAddress().length === 0)
            return 'Sign-In Address needs to be set';

        if (this._credentials.username().length === 0)
            return 'Username needs to be set';

        if (this._credentials.password().length === 0)
            return 'Password needs to be set';

        if (this._credentials.secretKey().length === 0)
            return 'Secret key needs to be set';

        let [suc, msg] = this._login();
        if (!suc)
            return `Could not login, got following error:\n${msg}`;

        return 'Ok';
    }

    /**
     * Sync the account data from the 1Password client.
     */
    sync() {
        let cmd = 'op list items';

        let [suc, resp] = this._sendShellCommandBitwarden(cmd);

        if (suc) {
            let accounts = JSON.parse(resp);

            this._accounts = accounts.map(account => ({
                name: account.overview.title,
            }));
        }
    }

    /**
     * Get username for site.
     * @param {string} name - Name of site.
     * @return {string} The username.
     */
    getAccountUsername(name) {
        let cmd = `op get item "${name}" --fields username`;
        let [suc, resp] = this._sendShellCommandBitwarden(cmd);

        if (suc) {
            return resp;
        }
    }

    /**
     * Get password for site.
     * @param {string} name - Name of site.
     * @return {string} The password.
     */
    getAccountPassword(name) {
        let cmd = `op get item "${name}" --fields password`;
        let [suc, resp] = this._sendShellCommandBitwarden(cmd);

        if (suc) {
            return resp;
        }
    }
};
