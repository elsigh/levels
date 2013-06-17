cordova.define('cordova/plugin/contactview', function(require, exports, module) {
  var exec = require('cordova/exec');

  var ContactView = {};

  ContactView.show = function(win, fail, opt_emailOrPhone) {
    var emailOrPhone = !_.isUndefined(opt_emailOrPhone) ?
        opt_emailOrPhone : 'phone';
    return exec(win, fail, 'ContactView', '', [emailOrPhone]);
  };

  module.exports = ContactView;
});
