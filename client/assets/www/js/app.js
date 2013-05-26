
/**
 * @type {Object}
 */
var fmb = {};


/******************************************************************************/


/**
 * @type {Object} UA namespace.
 */
fmb.ua = {};


/**
 * @type {boolean}
 */
fmb.ua.IS_ANDROID = window.navigator.userAgent.indexOf('Android') !== -1;


/**
 * @type {boolean}
 */
fmb.ua.IS_CORDOVA = typeof cordova !== 'undefined';


/******************************************************************************/


/**
 * @return {Function} The native console.log implementation.
 * @private
 */
fmb.getConsoleLogger_ = function() {
  return _.bind(console.log, console);
};


/**
 * @return {Function} A wrapped up stringifier.
 * @private
 */
fmb.getWebViewLogger_ = function() {
  return _.bind(function() {
      var argumentsArray = _.toArray(arguments);
      var consoleStrings = [];
      _.each(argumentsArray, function(logLine) {
        if (_.isElement(logLine)) {
          consoleStrings.push('isElement-className: ' + logLine.className);
        } else if (_.isObject(logLine)) {
          // Some of our objects have circular references..
          try {
            // Wrapped in quotation marks for later parseability.
            var stringified = '"' + JSON.stringify(logLine) + '"';
            consoleStrings.push(stringified);
          } catch (err) {
            consoleStrings.push(logLine);
          }
        } else {
          consoleStrings.push(logLine);
        }
      });

      var consoleString = consoleStrings.join(', ');
      console.log(consoleString);
    }, console);
};


/**
 * Good times, wrap fmb.log
 */
fmb.log = fmb.ua.IS_ANDROID && fmb.ua.IS_CORDOVA ?
    fmb.getWebViewLogger_() : fmb.getConsoleLogger_();


/**
 * @param {Object} obj An object to clone.
 * @return {Object} A deep clone of the passed in object.
 */
fmb.clone = function(obj) {
  return JSON.parse(JSON.stringify(obj));
};


/**
 * @constructor
 * @param {Object} options Config options.
 */
fmb.App = Backbone.Router.extend();


/**
 * @enum {Object}
 */
fmb.App.Routes = {
  ACCOUNT: {
    url: 'account',
    handler: 'routeAccount_'
  },
  FOLLOWING: {
    url: 'following',
    handler: 'routeFollowing_'
  }
};


/**
 * @type {number}
 */
fmb.App.PAUSE_RESUME_TIMEOUT_MS = 150;



/**
 * i.e. Are we running in the background in PhoneGap.
 * @type {Boolean}
 * @private
 */
fmb.App.isPhonePaused_ = false;


/**
 * @type {Object} batteryInfo Phonegap battery info.
 */
fmb.App.onBatteryStatus_ = function(batteryInfo) {
  fmb.log('fmb.App.onBatteryStatus_', batteryInfo);
  window.navigator.battery = window.navigator.battery || {};
  window.navigator.battery.level = batteryInfo['level'];
  window.navigator.battery.isPlugged = batteryInfo['isPlugged'];
  window['app'].model.user.device.trigger('battery_status');
};


/** @inheritDoc */
fmb.App.prototype.initialize = function(options) {
  fmb.log('fmb.App initialize');

  _.each(fmb.App.Routes, _.bind(function(route) {
    this.route(route.url, route.handler);
  }, this));

  // Bound cordova events.
  document.addEventListener('pause',
      _.bind(this.onPhonePause, this),
      false);
  document.addEventListener('resume',
      _.bind(this.onPhoneResume, this),
      false);
  window.plugins && window.plugins.webintent.onNewIntent(
     _.bind(this.checkIntent_, this));

  // We reference window.app so we need it to exist first.
  _.defer(_.bind(function() {
    this.model = new fmb.models.App();
    this.view = new fmb.views.App({model: this.model});

    _.defer(_.bind(function() {
      this.onPhoneResume_();
      this.initHistory_();
      this.checkIntent_();
      window.navigator.splashscreen &&
          _.delay(window.navigator.splashscreen.hide, 2000);
    }, this));
  }, this));
};


/**
 * Initializes Backbone.history in our app.
 * @private
 */
fmb.App.prototype.initHistory_ = function() {
  fmb.log('fmb.App.initHistory_' + window.location.hash);

  var usePushState = true;
  var root = '/app/';
  var silent = false;

  fmb.log('Backbone.history.start', usePushState, silent);
  var matchedRoute = Backbone.history.start({
    pushState: usePushState,
    root: root,
    silent: silent
  });
  if (!matchedRoute) {
    console.warn('No matchedRoute in initHistory');
    if (this.model.user && this.model.user.get('api_token')) {
      this.navigate(fmb.App.Routes.FOLLOWING.url, {trigger: true});
    } else {
      this.navigate(fmb.App.Routes.ACCOUNT.url, {trigger: true});
    }
  }
};


/**
 * @type {RegExp}
 */
fmb.App.FOLLOWING_URL_RE = /followmybattery\.com\/profile\/(.*)/;


/**
 * @private
 */
fmb.App.prototype.checkIntent_ = function() {
  fmb.log('fmb.App checkIntent');
  if (!(window.plugins && window.plugins.webintent)) {
    return;
  }

  window.plugins.webintent.getExtra(WebIntent.EXTRA_TEXT,
      function (url) {
        fmb.log('fmb.App webintent get EXTRA_TEXT got url', url);
      },
      function() {
        fmb.log('fmb.App webintent get EXTRA_TEXT got NADA');
      });

  window.plugins.webintent.getUri(
      function(url) {
        var match = fmb.App.FOLLOWING_URL_RE.exec(url);
        fmb.log('fmb.App webintent getUri:', url, match);
        if (match && match.length) {
          var userKey = match[1];
          _.delay(_.bind(function() {
            app.model.user.get('following').addByKey(userKey);
          }, window['app']), 300);
        }
      },
      function() {
        fmb.log('fmb.App webintent getUri NADA');
      });
};


/**
 * @private
 */
fmb.App.prototype.routeAccount_ = function() {
  fmb.log('fmb.App routeAccount_');
  this.view.transitionPage(fmb.App.Routes.ACCOUNT);
};


/**
 * @private
 */
fmb.App.prototype.routeFollowing_ = function() {
  fmb.log('fmb.App routeFollowing_');
  this.view.transitionPage(fmb.App.Routes.FOLLOWING);
};


/**
 * @type {number}
 * @private
 */
fmb.App.prototype.pauseResumeTimeout_ = null;


/**
 * @private
 */
fmb.App.prototype.clearPauseResumeTimeout_ = function() {
  if (this.pauseResumeTimeout_ !== null) {
    fmb.log('fmb.App clearPauseResumeTimeout_ clearing a timer!');
    window.clearTimeout(this.pauseResumeTimeout_);
    this.pauseResumeTimeout_ = null;
  }
};


/**
 * Delayed w/ state for PhoneGap.
 */
fmb.App.prototype.onPhonePause = function() {
  fmb.log('fmb.App.onPhonePause');
  if (fmb.App.isPhonePaused_) {
    fmb.log('.. already paused, bail.');
    return;
  }
  fmb.log('^^^^ PAUSE PAUSE PAUSE PAUSE PAUSE ^^^^');

  fmb.App.isPhonePaused_ = true;
  this.clearPauseResumeTimeout_();
  this.pauseResumeTimeout_ = _.delay(_.bind(this.onPhonePause_, this),
                                     fmb.App.PAUSE_RESUME_TIMEOUT_MS);
};


/**
 * @private
 */
fmb.App.prototype.onPhonePause_ = function() {
  fmb.log('fmb.App onPhonePause_');
  window.removeEventListener('batterystatus',
                             fmb.App.onBatteryStatus_,
                             false);

  app.view.currentView &&
      app.view.currentView.setIsActive &&
      app.view.currentView.setIsActive(false);
};


/**
 * Delayed w/ state for PhoneGap.
 */
fmb.App.prototype.onPhoneResume = function() {
  fmb.log('fmb.App onPhoneResume');
  if (!fmb.App.isPhonePaused_) {
    fmb.log('.. not paused, bail.');
    return;
  }
  fmb.log('^^^^ RESUME RESUME RESUME RESUME RESUME ^^^^');

  fmb.App.isPhonePaused_ = false;

  this.clearPauseResumeTimeout_();
  this.pauseResumeTimeout_ = _.delay(_.bind(this.onPhoneResume_, this),
                                     fmb.App.PAUSE_RESUME_TIMEOUT_MS);
};


/**
 * @private
 */
fmb.App.prototype.onPhoneResume_ = function() {
  fmb.log('fmb.App onPhoneResume_');

  window.addEventListener('batterystatus',
                          fmb.App.onBatteryStatus_,
                          false);

  app.view.currentView &&
      app.view.currentView.setIsActive &&
      app.view.currentView.setIsActive(true);
};

