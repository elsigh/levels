
cordova.define('cordova/plugin/phonediedservice', function(require, exports, module) {

  var exec = require('cordova/exec');
  var plugin = {};

  plugin.startService = function(win, fail) {
    return exec(win, fail, 'PhoneDiedPlugin', 'startService',
        [app.model.user.get('api_token'),
         app.model.user.get('id'),
         app.model.device.get('id'),
         app.model.device.get('update_frequency'),
         fmb.models.getApiUrl('/settings')
        ]);
  };

  plugin.stopService = function(win, fail) {
    return exec(win, fail, 'PhoneDiedPlugin', 'stopService', []);
  };

  module.exports = plugin;
});
