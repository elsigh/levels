cordova.define('cordova/plugin/contactview', function(require, exports, module) {
  var exec = require('cordova/exec');

  var ContactView = {};

  ContactView.show = function(win, fail) {
    return exec(win, fail, 'ContactView', '', []);
  };

  module.exports = ContactView;
});