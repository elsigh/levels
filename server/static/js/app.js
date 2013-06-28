


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
    url: 'follow/:userUniqueProfileStr',
    handler: 'routeFollow_'
  },
  FOLLOWING: {
    url: 'following',
    handler: 'routeFollowing_'
  },
  HOW_IT_WORKS: {
    url: 'how_it_works',
    handler: 'routeHowItWorks_'
  }
};


/**
 * @param {string} url An url to look for.
 * @return {Object} One of fmb.App.Routes or undefined.
 */
fmb.App.getRouteByUrl = function(url) {
  var matchingRoute;
  _.each(fmb.App.Routes, function(route) {
    if (route.url == url) {
      matchingRoute = route;
    }
  });
  return matchingRoute;
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
 * @param {Object} batteryInfo Phonegap battery info.
 * @private
 */
fmb.App.onBatteryStatus_ = function(batteryInfo) {
  fmb.log('fmb.App.onBatteryStatus_', batteryInfo);
  window.navigator.battery = window.navigator.battery || {};
  window.navigator.battery.level = batteryInfo['level'];
  window.navigator.battery.isPlugged = batteryInfo['isPlugged'];
  if (window['app'].model.user.device) {
    window['app'].model.user.device.trigger('battery_status');
  } else {
    fmb.log('Not triggering device battery_status - no device yet.');
  }
};


/** @inheritDoc */
fmb.App.prototype.initialize = function(options) {
  fmb.log('fmb.App initialize');

  //fmb.injectScript('http://192.168.1.9:9090/target/target-script-min.js#anonymous');

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

  // Android intent plugin
  window.plugins && window.plugins.webintent &&
      window.plugins.webintent.onNewIntent(
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

    this.navigate(fmb.App.Routes.ACCOUNT.url, {trigger: true});

    /*
    // Only take them to the stats page if they're pretty well set up.
    if (this.model.user && this.model.user.get('api_token') &&
        this.model.user.device &&
        this.model.user.device.get('notifying').length) {
      this.navigate(fmb.App.Routes.FOLLOWING.url, {trigger: true});

    } else {
      this.navigate(fmb.App.Routes.ACCOUNT.url, {trigger: true});
    }
    */
  }
};


/**
 * @type {RegExp}
 */
fmb.App.FOLLOWING_BY_UNIQUE_STR_URL_RE = /levelsapp\.com\/p\/(.*)/;


/**
 * @param {string} url An intent URL.
 * @private
 */
fmb.App.prototype.checkIntent_ = function(url) {
  fmb.log('fmb.App checkIntent', url);
  if (!(window.plugins && window.plugins.webintent)) {
    return;
  }

  // When invoked via a notification in the systra, we put the
  // URL into WebIntent.EXTRA_TEXT.
  window.plugins.webintent.getExtra(WebIntent.EXTRA_TEXT,
      _.bind(function(url) {
        fmb.log('fmb.App checkIntent YES WebIntent.EXTRA_TEXT', url);
        this.checkIntentUrlForUser_(url);
      }, this),
      function() {
        fmb.log('fmb.App checkIntent NO WebIntent.EXTRA_TEXT');
        // Something really bad happened.
      });

  if (url) {
    this.checkIntentUrlForUser_(url);
  } else {
    window.plugins.webintent.getUri(
        _.bind(this.checkIntentUrlForUser_, this),
        function() {
          fmb.log('fmb.App webintent getUri NADA');
        });
  }
};


/**
 * @param {string} url
 * @private
 */
fmb.App.prototype.checkIntentUrlForUser_ = function(url) {
  fmb.log('fmb.App checkIntentUrlForUser_', url);
  if (!url) {
    fmb.log('.. bail, no URL');
    return;
  }
  var match = fmb.App.FOLLOWING_BY_UNIQUE_STR_URL_RE.exec(url);
  if (match && match.length) {
    fmb.log('fmb.App checkIntentUrlForUser_', url, match);
    var userUniqueProfileStr = match[1];
    _.delay(_.bind(function() {
      this.navigate(
          fmb.App.Routes.FOLLOWING.url.
              replace(':userUniqueProfileStr', userUniqueProfileStr),
          {trigger: true});
    }, this), 300);

  }
};


/**
 * @private
 */
fmb.App.prototype.routeAccount_ = function() {
  fmb.log('fmb.App routeAccount_');
  this.view.transitionPage(fmb.App.Routes.ACCOUNT);
};


/**
 * @param {string} userUniqueProfileStr The user's unique_profile_str.
 * @private
 */
fmb.App.prototype.routeFollow_ = function(userUniqueProfileStr) {
  fmb.log('fmb.App routeFollow_', userUniqueProfileStr);
  this.model.user.get('following').addByUniqueProfileStr(
      userUniqueProfileStr);
  this.view.transitionPage(fmb.App.Routes.FOLLOWING);
};


/**
 * @private
 */
fmb.App.prototype.routeFollowing_ = function() {
  fmb.log('fmb.App routeFollowing_');
  this.view.transitionPage(fmb.App.Routes.FOLLOWING);
};


/**
 * @private
 */
fmb.App.prototype.routeHowItWorks_ = function() {
  fmb.log('fmb.App routeHowItWorks_');
  this.view.transitionPage(fmb.App.Routes.HOW_IT_WORKS);
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

