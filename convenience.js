const Gio = imports.gi.Gio;
const Secret = imports.gi.Secret;

const Me = imports.misc.extensionUtils.getCurrentExtension();

const SCHEMA = new Secret.Schema(
  "org.gnome.shell.extensions.password-manager-search",
  Secret.SchemaFlags.NONE,
  {
    name: Secret.SchemaAttributeType.STRING
  }
);

function getLogins() {
  let logins = Secret.password_lookup_sync(
    SCHEMA,
    { name: "password-manager-search" },
    null
  );
  if (logins === null) {
    return {};
  }
  return JSON.parse(logins);
}

function getLogin(site) {
  let logins = getLogins();

  if (site in logins) {
    return logins[site];
  }
  return null;
}

function setLogin(site, username, password) {
  let logins = getLogins();

  logins[site] = { username: username, password: password };
  Secret.password_store_sync(
    SCHEMA,
    { name: "password-manager-search" },
    Secret.COLLECTION_DEFAULT,
    "JSON logins for password managers",
    JSON.stringify(logins),
    null
  );
}

/**
 * Builds and return a GSettings schema for @schema, using schema files in
 * extensiondir/schemas. Schema path is taken from metadata['settings-schema'].
 * @return {Gio.Settings}
 */
function getSettings() {
  const GioSSS = Gio.SettingsSchemaSource;

  // Check if this extension was built with "make zip-file", and thus
  // has the schema files in a subfolder
  // otherwise assume that extension has been installed in the
  // same prefix as gnome-shell (and therefore schemas are available
  // in the standard folders)
  let schemaDir = Me.dir.get_child("schemas");
  let schemaSource;
  if (schemaDir.query_exists(null)) {
    schemaSource = GioSSS.new_from_directory(
      schemaDir.get_path(),
      GioSSS.get_default(),
      false
    );
  } else {
    schemaSource = GioSSS.get_default();
  }

  let schemaObj = schemaSource.lookup(Me.metadata["settings-schema"], true);
  if (!schemaObj) {
    throw new Error(
      "Schema " +
        Me.metadata["settings-schema"] +
        " could not be found for extension " +
        Me.metadata.uuid +
        ". Please check your installation."
    );
  }

  return new Gio.Settings({
    settings_schema: schemaObj
  });
}
