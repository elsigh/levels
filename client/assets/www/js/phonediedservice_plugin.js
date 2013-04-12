
cordova.define('cordova/plugin/phonediedservice', function(require, exports, module) {

  var exec = require('cordova/exec');
  var plugin = {};

  plugin.startService = function(win, fail) {
    return exec(win, fail, 'PhoneDiedPlugin', 'startService',
        [fmb.models.sync.authToken,
         app.model.device.get('uuid'),
         app.model.device.get('update_frequency'),
         fmb.models.getApiUrl('/settings/' +
                              app.model.device.get('uuid'))
        ]);
  };

  plugin.stopService = function(win, fail) {
    return exec(win, fail, 'PhoneDiedPlugin', 'stopService', []);
  };

  module.exports = plugin;
});
