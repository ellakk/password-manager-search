const Gio = imports.gi.Gio;
const Notify = imports.gi.Notify;
const Me = imports.misc.extensionUtils.getCurrentExtension();

/**
 * Log error message.
 * @param {string} msg - The error message.
 */
function eLog(msg) {
    log(`Error in Password Manager extension: ${msg}`);
}

/**
 * Send desktop notification.
 * @param {string} summary - The title of the message.
 * @param {string} body - The body of the message.
 */
function sendNotification(summary, body) {
    let manager = getSettings().get_string('manager');
    let icon = 'dialog-password';

    if (manager !== 'NONE')
        icon = `${Me.path}/icons/${manager.toLowerCase()}.png`;

    Notify.init('Password Manager Search');
    new Notify.Notification({
        summary,
        body,
        'icon-name': icon,
    }).show();
}

/**
 * Builds and return a GSettings schema for @schema, using schema files in
 * extensiondir/schemas. Schema path is taken from metadata['settings-schema'].
 * @return {Gio.Settings} The settings for the extension.
 */
function getSettings() {
    const GioSSS = Gio.SettingsSchemaSource;

    // Check if this extension was built with "make zip-file", and thus
    // has the schema files in a subfolder
    // otherwise assume that extension has been installed in the
    // same prefix as gnome-shell (and therefore schemas are available
    // in the standard folders)
    const schemaDir = Me.dir.get_child('schemas');
    let schemaSource;
    if (schemaDir.query_exists(null)) {
        schemaSource = GioSSS.new_from_directory(
            schemaDir.get_path(),
            GioSSS.get_default(),
            false,
        );
    } else {
        schemaSource = GioSSS.get_default();
    }

    const schemaObj = schemaSource.lookup(Me.metadata['settings-schema'], true);
    if (!schemaObj) {
        throw new Error(
            `Schema ${Me.metadata['settings-schema']} couldnot be found for ` +
                `extension ${Me.metadata.uuid}. Please check your installation.`,
        );
    }

    return new Gio.Settings({
        settings_schema: schemaObj,
    });
}
