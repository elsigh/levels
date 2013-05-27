
cordova.define('cordova/plugin/levels', function(require, exports, module) {

  var exec = require('cordova/exec');
  var plugin = {};

  plugin.startService = _.debounce(function(win, fail) {
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

  plugin.stopService = function(win, fail) {
    return exec(win, fail, 'LevelsPlugin', 'stopService', []);
  };

  plugin.beaconSettings = function(win, fail) {
    return exec(win, fail, 'LevelsPlugin', 'beaconSettings', []);
  }

  module.exports = plugin;
});
