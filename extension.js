const Main = imports.ui.main;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const PasswordManagerSearchProvider = Me.imports.passwordManagerSearchProvider;

let passwordManagerSearchProvider = null;

function init(extensionMeta) {}

function enable() {
    if (!passwordManagerSearchProvider) {
        passwordManagerSearchProvider = new PasswordManagerSearchProvider.PasswordManagerSearchProvider();
        if (passwordManagerSearchProvider.enabled) {
            Main.overview.viewSelector._searchResults._registerProvider(
                passwordManagerSearchProvider,
            );
        }
    }
}

function disable() {
    if (passwordManagerSearchProvider) {
        if (passwordManagerSearchProvider.enabled) {
            Main.overview.viewSelector._searchResults._unregisterProvider(
                passwordManagerSearchProvider,
            );
            passwordManagerSearchProvider.enabled = false;
        }
        passwordManagerSearchProvider = null;
    }
}
