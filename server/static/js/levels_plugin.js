
var exec = require('cordova/exec');
var platformId = require('cordova/platform').id;


/** @return {Function} A promise. */
exports.setDeviceModel = function() {
  return exec(
      function(result) {
        fmb.log('Got device model', result);
        // Only do this for Android.
        if (platformId == 'android' &&
            window.device && window.device.model) {
          window.device.model = result;
          fmb.log('Set window.device.model to', result);
        } else {
          fmb.log('Not overloading window.device.model on non-android');
        }
      },
      null,
      'LevelsPlugin', 'getDeviceModelName', []);
};


/** Good times. */
exports.startService = _.debounce(function(win, fail) {
  fmb.log('LevelsServicePlugin - startService');
  if (!app.model.user.get('api_token')) {
    fmb.log('levels-plugin not starting - NO API TOKEN!');
    return;
  }

  return exec(win, fail, 'LevelsPlugin', 'startService',
      [app.model.user.get('api_token'),
       app.model.user.id,
       app.model.user.device.id,
       app.model.user.device.get('update_frequency'),
       fmb.models.getApiUrl('/settings')
      ]);
}, 10 * 1000, true);


/**
 * @param {Function} win A success handler.
 * @param {Function} fail A fail handler.
 * @return {Function} A promise.
 */
exports.stopService = function(win, fail) {
  return exec(win, fail, 'LevelsPlugin', 'stopService', []);
};


/**
 * @param {Function} win A success handler.
 * @param {Function} fail A fail handler.
 * @return {Function} A promise.
 */
exports.beaconSettings = function(win, fail) {
  return exec(win, fail, 'LevelsPlugin', 'beaconSettings', []);
};


/**
 * @param {Function} msg Text to show.
 * @return {Function} A promise.
 */
exports.showMessage = function(msg) {
  return exec(null, null, 'LevelsPlugin', 'showMessage', [msg]);
};


/**
 * @param {Function} win A success handler.
 * @param {Function} fail A fail handler.
 * @return {Function} A promise.
 */
exports.getVersionCode = function(win, fail) {
  return exec(win, fail, 'LevelsPlugin', 'getVersionCode', []);
};


/**
 * @param {Function} subject A success handler.
 * @param {Function} text A fail handler.
 * @param {Function} win A success handler.
 * @param {Function} fail A fail handler.
 * @return {Function} A promise.
 */
exports.shareApp = function(subject, text, win, fail) {
  if (fmb.ua.IS_ANDROID) {
    var extras = {};
    extras[WebIntent.EXTRA_SUBJECT] = subject;
    extras[WebIntent.EXTRA_TEXT] = text;
    window.plugins.webintent.startActivity({
      action: WebIntent.ACTION_SEND,
      type: 'text/plain',
      extras: extras
    },
    win,
    fail);
  } else {
    return exec(win, fail, 'LevelsPlugin', 'shareApp', [subject, text]);
  }
};
