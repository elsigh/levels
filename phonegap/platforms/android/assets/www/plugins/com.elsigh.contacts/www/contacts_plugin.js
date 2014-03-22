cordova.define("com.elsigh.contacts.ContactsPlugin", function(require, exports, module) { 
var exec = require('cordova/exec');
exports.show = function(win, fail, opt_emailOrPhone) {
  var emailOrPhone = !_.isUndefined(opt_emailOrPhone) ?
      opt_emailOrPhone : 'phone';
  return exec(win, fail, 'ContactsPlugin', 'show', [emailOrPhone]);
};

});
