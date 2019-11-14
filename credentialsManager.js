const Secret = imports.gi.Secret;

var CredentialsManager = class PMSCredentialsManager {
  constructor() {
    this.schema = new Secret.Schema(
      "org.gnome.shell.extensions.password-manager-search",
      Secret.SchemaFlags.NONE,
      {
        name: Secret.SchemaAttributeType.STRING
      }
    );
  }

  _getCredentials() {
    let credentials = Secret.password_lookup_sync(
      this.schema,
      { name: "password-manager-search" },
      null
    );
    if (credentials === null) {
      return {};
    }
    return JSON.parse(credentials);
  }

  _delCredentials() {
    Secret.password_clear_sync(
      this.schema,
      { name: "password-manager-search" },
      null
    );
  }

  getCredential(site) {
    let credentials = this._getCredentials();

    if (site in credentials) {
      return credentials[site];
    }
    return null;
  }

  setCredential(site, username, password) {
    let credentials = this._getCredentials();

    credentials[site] = { username: username, password: password };

    this._delCredentials();
    Secret.password_store_sync(
      this.schema,
      { name: "password-manager-search" },
      Secret.COLLECTION_DEFAULT,
      "JSON credentials for password managers",
      JSON.stringify(credentials),
      null
    );
  }
};
