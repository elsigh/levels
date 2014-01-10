cordova.define('cordova/plugin_list', function(require, exports, module) {
module.exports = [
    {
        "file": "plugins/org.apache.cordova.core.network-information/www/network.js",
        "id": "org.apache.cordova.core.network-information.network",
        "clobbers": [
            "navigator.connection",
            "navigator.network.connection"
        ]
    },
    {
        "file": "plugins/org.apache.cordova.core.network-information/www/Connection.js",
        "id": "org.apache.cordova.core.network-information.Connection",
        "clobbers": [
            "Connection"
        ]
    },
    {
        "file": "plugins/org.apache.cordova.core.device/www/device.js",
        "id": "org.apache.cordova.core.device.device",
        "clobbers": [
            "device"
        ]
    },
    {
        "file": "plugins/org.apache.cordova.core.battery-status/www/battery.js",
        "id": "org.apache.cordova.core.battery-status.battery",
        "clobbers": [
            "navigator.battery"
        ]
    },
    {
        "file": "plugins/org.apache.cordova.core.splashscreen/www/splashscreen.js",
        "id": "org.apache.cordova.core.splashscreen.SplashScreen",
        "clobbers": [
            "navigator.splashscreen"
        ]
    },
    {
        "file": "plugins/com.borismus.webintent/www/webintent.js",
        "id": "com.borismus.webintent.WebIntent",
        "clobbers": [
            "WebIntent"
        ]
    },
    {
        "file": "plugins/com.elsigh.contacts/www/contacts_plugin.js",
        "id": "com.elsigh.contacts.ContactsPlugin"
    },
    {
        "file": "plugins/com.elsigh.levels/www/levels_plugin.js",
        "id": "com.elsigh.levels.LevelsPlugin"
    },
    {
        "file": "plugins/com.phonegap.plugins.PushPlugin/www/PushNotification.js",
        "id": "com.phonegap.plugins.PushPlugin.PushNotification"
    },
    {
        "file": "plugins/org.chromium.common/events.js",
        "id": "org.chromium.common.events",
        "clobbers": [
            "chrome.Event"
        ]
    },
    {
        "file": "plugins/org.chromium.common/errors.js",
        "id": "org.chromium.common.errors"
    },
    {
        "file": "plugins/org.chromium.common/stubs.js",
        "id": "org.chromium.common.stubs"
    },
    {
        "file": "plugins/org.chromium.common/helpers.js",
        "id": "org.chromium.common.helpers"
    },
    {
        "file": "plugins/org.chromium.common/lib/CryptoJS/sha256.js",
        "id": "org.chromium.common.CryptoJS-sha256"
    },
    {
        "file": "plugins/org.chromium.common/lib/CryptoJS/enc-base64-min.js",
        "id": "org.chromium.common.CryptoJS-enc-base64-min"
    },
    {
        "file": "plugins/org.chromium.storage/storage.js",
        "id": "org.chromium.storage.Storage",
        "clobbers": [
            "chrome.storage"
        ]
    },
    {
        "file": "plugins/org.chromium.runtime/api/app/runtime.js",
        "id": "org.chromium.runtime.app.runtime",
        "clobbers": [
            "chrome.app.runtime"
        ]
    },
    {
        "file": "plugins/org.chromium.runtime/api/runtime.js",
        "id": "org.chromium.runtime.runtime",
        "clobbers": [
            "chrome.runtime"
        ]
    },
    {
        "file": "plugins/org.chromium.identity/identity.js",
        "id": "org.chromium.identity.Identity",
        "clobbers": [
            "chrome.identity"
        ]
    }
];
module.exports.metadata = 
// TOP OF METADATA
{
    "org.apache.cordova.core.network-information": "0.2.1",
    "org.apache.cordova.core.device": "0.2.1",
    "org.apache.cordova.core.battery-status": "0.2.1",
    "org.apache.cordova.core.splashscreen": "0.2.0",
    "com.borismus.webintent": "1.0.0",
    "com.elsigh.contacts": "0.1",
    "com.elsigh.levels": "0.1",
    "com.phonegap.plugins.PushPlugin": "2.0.3",
    "org.chromium.common": "1.0.1",
    "org.chromium.storage": "1.0.1",
    "org.chromium.runtime": "1.0.1",
    "org.chromium.identity": "1.0.1"
}
// BOTTOM OF METADATA
});