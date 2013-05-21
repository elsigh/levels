
cordova.define('cordova/plugin/phonediedservice', function(require, exports, module) {

  var exec = require('cordova/exec');
  var plugin = {};

  plugin.startService = function(win, fail) {
    fmb.log('PhoneDiedServicePlugin - startService');
    if (!app.model.user.get('api_token')) {
      fmb.log('phonediedservice-plugin not starting - NO API TOKEN!');
      return;
    }
    if (this.running_) {
      fmb.log('phonediedservice-plugin ALREADY RUNNING');
      return;
    }
    this.running_ = true;
    return exec(win, fail, 'PhoneDiedPlugin', 'startService',
        [app.model.user.get('api_token'),
         app.model.user.get('id'),
         app.model.user.device.get('id'),
         app.model.user.device.get('update_frequency'),
         fmb.models.getApiUrl('/settings')
        ]);
  };

  plugin.stopService = function(win, fail) {
    return exec(win, fail, 'PhoneDiedPlugin', 'stopService', []);
  };

  module.exports = plugin;
});
