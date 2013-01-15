
/**
 * @type {Object}
 */
var fmb = {};


(function($) {
  // only do this if not on a touch device
  if (!('ontouchend' in window)) {
    $(document).delegate('body', 'click', function(e) {
      e.preventDefault();
      $(e.target).trigger('tap', e);
    });
  } else {
    $(document).delegate('body', 'click', function(e) {
      e.preventDefault();
    });
  }
})(window.Zepto);


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
  },
  NOTIFYING: {
    url: 'notifying',
    handler: 'routeNotifying_'
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
  window.navigator.battery.level = batteryInfo['level'];
  window.navigator.battery.isPlugged = batteryInfo['isPlugged'];
  window['app'].model.device.trigger('battery_status');
};


/** @inheritDoc */
fmb.App.prototype.initialize = function(options) {
  console.log('fmb.App initialize');

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
  console.log('fmb.App.initHistory_' + window.location.hash);

  var usePushState = true;
  var root = '/app/';
  var silent = false;

  console.log('Backbone.history.start', usePushState, silent);
  var matchedRoute = Backbone.history.start({
    pushState: usePushState,
    root: root,
    silent: silent
  });
  if (!matchedRoute) {
    console.warn('No matchedRoute in initHistory',
                 this.model.profile.get('username'));
    if (this.model.profile.get('username')) {
      this.navigate(fmb.App.Routes.FOLLOWING.url, {trigger: true});
    } else {
      this.navigate(fmb.App.Routes.ACCOUNT.url, {trigger: true});
    }
  }
};


/**
 * @type {RegExp}
 */
fmb.App.FOLLOWING_URL_RE = /http:\/\/www\.followmybattery\.com\/(.*)/;


/**
 * @private
 */
fmb.App.prototype.checkIntent_ = function() {
  console.log('checkIntent');
  window.plugins &&
      window.plugins.webintent.getExtra(WebIntent.EXTRA_TEXT, function (url) {
    //alert('GOT INTENT URL' + url);
  }, function() {
    //alert('Nada');
  });
  window.plugins && window.plugins.webintent.getUri(
      function(url) {
        console.log('checkIntent_ getUri:' + url);
        var match = fmb.App.FOLLOWING_URL_RE.exec(url);
        if (match && match.length) {
          var username = match[1];
          _.delay(_.bind(function() {
            app.model.following.addByUsername(username);
          }, window['app']), 300);
        }
      });
};


/**
 * @private
 */
fmb.App.prototype.routeAccount_ = function() {
  console.log('routeAccount_');
  this.view.transitionPage(fmb.App.Routes.ACCOUNT);
};


/**
 * @private
 */
fmb.App.prototype.routeFollowing_ = function() {
  this.view.transitionPage(fmb.App.Routes.FOLLOWING);
};


/**
 * @private
 */
fmb.App.prototype.routeNotifying_ = function() {
  this.view.transitionPage(fmb.App.Routes.NOTIFYING);
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
    console.log('fmb.App clearPauseResumeTimeout_ clearing a timer!');
    window.clearTimeout(this.pauseResumeTimeout_);
    this.pauseResumeTimeout_ = null;
  }
};


/**
 * Delayed w/ state for PhoneGap.
 */
fmb.App.prototype.onPhonePause = function() {
  console.log('fmb.App.onPhonePause');
  if (fmb.App.isPhonePaused_) {
    console.log('.. already paused, bail.');
    return;
  }
  console.log('^^^^ PAUSE PAUSE PAUSE PAUSE PAUSE ^^^^');

  fmb.App.isPhonePaused_ = true;
  this.clearPauseResumeTimeout_();
  this.pauseResumeTimeout_ = _.delay(_.bind(this.onPhonePause_, this),
                                     fmb.App.PAUSE_RESUME_TIMEOUT_MS);
};


/**
 * @private
 */
fmb.App.prototype.onPhonePause_ = function() {
  console.log('onPhonePause_');
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
  console.log('fmb.App onPhoneResume');
  if (!fmb.App.isPhonePaused_) {
    console.log('.. not paused, bail.');
    return;
  }
  console.log('^^^^ RESUME RESUME RESUME RESUME RESUME ^^^^');

  fmb.App.isPhonePaused_ = false;

  this.clearPauseResumeTimeout_();
  this.pauseResumeTimeout_ = _.delay(_.bind(this.onPhoneResume_, this),
                                     fmb.App.PAUSE_RESUME_TIMEOUT_MS);
};


/**
 * @private
 */
fmb.App.prototype.onPhoneResume_ = function() {
  console.log('onPhoneResume_');

  window.addEventListener('batterystatus',
                          fmb.App.onBatteryStatus_,
                          false);

  app.view.currentView &&
      app.view.currentView.setIsActive &&
      app.view.currentView.setIsActive(true);
};

