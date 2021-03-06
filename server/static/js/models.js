


/******************************************************************************/



/**
 * @extends {Backbone.Model}
 * @constructor
 */
fmb.models.App = Backbone.Model.extend();


/** @inheritDoc */
fmb.models.App.prototype.initialize = function(opt_data, opt_options) {
  fmb.log('fmb.models.App.initialize');
  fmb.Model.prototype.initialize.apply(this, arguments);

  // Phonegap's Android implementation of device.name is the product name
  // not something people will ever understandably recognize. Fix that.
  var plugin = cordova.require(fmb.App.LEVELS_PLUGIN_ID);
  plugin && plugin.setDeviceModel();
  plugin && plugin.getVersionCode(
      function(version) {
        fmb.log('GOT CLIENT VERSION!', version);
        fmb.models.App.version = version;
      },
      function() {
        fmb.log('FAIL - CLIENT VERSION :(');
      });

  // id is necessary for localStorage plugin with a model.
  var userKey = localStorage.getItem('user_key');
  fmb.log('userKey from localStorage', userKey);
  if (userKey) {
    this.user = new fmb.models.User({
      'key': userKey
    });
    this.user.fetchFromStorage();

  } else {
    this.user = new fmb.models.User();
  }
};


/******************************************************************************/



/**
 * @extends {Backbone.Collection}
 * @constructor
 */
fmb.models.Notify = fmb.Model.extend();


/** @inheritDoc */
fmb.models.Notify.prototype.url = function() {
  return fmb.models.getApiUrl('/notifying');
};


/******************************************************************************/



/**
 * @extends {Backbone.Collection}
 * @constructor
 */
fmb.models.NotifyingCollection = fmb.Collection.extend({
  model: fmb.models.Notify
});


/** @inheritDoc */
fmb.models.NotifyingCollection.prototype.initialize = function() {
  fmb.Collection.prototype.initialize.apply(this, arguments);
  this.on('add', this.onAdd_, this);
  this.on('remove', this.onRemove_, this);
};


/** @inheritDoc */
fmb.models.NotifyingCollection.prototype.url = function() {
  return fmb.models.getApiUrl('/notifying');
};


/** @inheritDoc */
fmb.models.NotifyingCollection.prototype.parse = function(response, xhr) {
  //fmb.log('fmb.models.NotifyingCollection parse', response);
  var obj = fmb.Model.prototype.parse.apply(this, arguments);
  return obj['notifying'] ? obj['notifying'] : obj;
};


/** @inheritDoc */
fmb.models.NotifyingCollection.prototype.fetch = function(opt_options) {
  var options = opt_options || {};
  options.data = {
    'device_key': this.parent.id
  };
  fmb.Collection.prototype.fetch.call(this, options);
};


/** @inheritDoc */
fmb.models.NotifyingCollection.prototype.add = function(obj, options) {
  var means = obj['means'];

  if (means === '') {
    return;
  }

  var alreadyNotifying = this.findWhere({
    'means': means
  });
  if (alreadyNotifying) {
    fmb.log('fmb.models.NotifyingCollection add bail, already notifying',
            means);
    alert('You are already notifying ' + means);
    return;
  }

  fmb.Collection.prototype.add.apply(this, arguments);
};


/**
 * @param {fmb.Model} model A notifying model.
 * @private
 */
fmb.models.NotifyingCollection.prototype.onAdd_ = function(model) {
  fmb.log('fmb.models.NotifyingCollection onAdd_:',
          model.id, model.get('means'));

  // Backing through the model collection / parent chain is also a
  // possibility but this looks cleaner.
  app.model.user.saveToStorage();

  if (model.id) {
    fmb.log('fmb.models.NotifyingCollection - no need to save', model.id,
            'to server, already has id.');
    return;
  }

  model.save({
    'device_key': this.parent.id,
    'cid': model.cid
  }, {
    wait: true,
    success: _.bind(function() {
      fmb.log('MONEY TRAIN save success w/ notify model', model.get('key'));
    }, this)
  });

};


/**
 * @param {fmb.Model} model A notifying model.
 * @private
 */
fmb.models.NotifyingCollection.prototype.onRemove_ = function(model) {
  fmb.log('fmb.models.NotifyingCollection onRemove_:',
          model.id, model.get('means'));

  // Backing through the model collection / parent chain is also a
  // possibility but this looks cleaner.
  app.model.user.saveToStorage();

  if (!model.get('key')) {
    fmb.log('fmb.models.NotifyingCollection onRemove no need',
            'w/out key from server.', model.get('means'));
    return;
  }

  model.save(null, {
    url: fmb.models.getApiUrl('/notifying/delete'),
    success: _.bind(function() {
    })
  });
};


/******************************************************************************/



/**
 * @extends {Backbone.Collection}
 * @constructor
 */
fmb.models.SettingsCollection = fmb.Collection.extend({
  model: fmb.Model
});


/** @inheritDoc */
fmb.models.SettingsCollection.prototype.comparator = function(model) {
  var d = new Date(model.get('created'));
  return -d.getTime();
};


/******************************************************************************/



/**
 * @extends {Backbone.Collection}
 * @constructor
 */
fmb.models.SettingsCausedBatteryNotificationsCollection =
    fmb.Collection.extend({
  model: fmb.Model
});


/** @inheritDoc */
fmb.models.SettingsCausedBatteryNotificationsCollection.prototype.comparator =
    function(model) {
  var d = new Date(model.get('created'));
  return -d.getTime();
};


/******************************************************************************/



/**
 * @extends {fmb.Model}
 * @constructor
 */
fmb.models.DeviceUnMapped = fmb.Model.extend({
  //localStorage: new Backbone.LocalStorage('Device'),
  defaults: {
    'user_agent_string': window.navigator.userAgent,
    'update_enabled': 1,
    'update_frequency': 10,  // Note, overridden in levels_plugin.js now.
    'notify_level': 10
  },
  submodels: {
    'notifying': fmb.models.NotifyingCollection,
    'settings': fmb.models.SettingsCollection,
    'settings_caused_battery_notifications':
        fmb.models.SettingsCausedBatteryNotificationsCollection
  }
});


/**
 * @return {string} The UUID of the current device.
 */
fmb.models.DeviceUnMapped.getUuid = function() {
  return window.device && window.device.uuid || navigator.appVersion;
};


/**
 * Callback.
 */
fmb.models.DeviceUnMapped.prototype.onBatteryStatus = function() {
  fmb.log('fmb.models.Device onBatteryStatus');
  // This should result in a settings beacon via our already-running service.
  var plugin = cordova.require(fmb.App.LEVELS_PLUGIN_ID);
  plugin && plugin.startService();

  if (!window.navigator.battery) {
    fmb.log('No window.navigator.battery =(');
    return;
  }

  // Clone the most recent setting if there is one and inject this
  // into our list since all we get here is battery info.
  // We want our UI to feel real-time, at least for battery info.

  var setting = new fmb.Model({
    'created': fmb.models.getISODate(),  // aka our server format.
    'battery_level': window.navigator.battery.level,
    'is_charging': window.navigator.battery.isPlugged
  });
  fmb.log('fmb.models.Device onBatteryStatus', this.id, setting.toJSON());
  this.get('settings').add(setting);
};


/** @inheritDoc */
fmb.models.DeviceUnMapped.prototype.getStorageData = function() {
  var obj = fmb.Model.prototype.getStorageData.call(this);

  // Don't store the long list of historical settings data.
  delete obj['settings'];

  return obj;
};


/** @inheritDoc */
fmb.models.DeviceUnMapped.prototype.fetch = function(opt_options) {
  var options = opt_options || {};
  options.data = {
    'device_key': this.id
  };
  fmb.Model.prototype.fetch.call(this, options);
};


/**
 * @return {string} An url.
 */
fmb.models.DeviceUnMapped.prototype.url = function() {
  return fmb.models.getApiUrl('/device');
};


/**
 * @return {Object} Template data.
 */
fmb.models.DeviceUnMapped.prototype.getTemplateData = function() {
  var templateData = fmb.Model.prototype.getTemplateData.call(this);
  // Converts 0 to no-key for mustache falsitude.
  if (!templateData['update_enabled']) {
    delete templateData['update_enabled'];
  }
  // Don't want to be able to delete the current device.
  if (app.model.user.device &&
      this.id === app.model.user.device.id) {
    templateData['is_user_device'] = true;
  }
  return templateData;
};



/**
 * @constructor
 */
fmb.models.Device = Backbone.IdentityMap(
    fmb.models.DeviceUnMapped);


/******************************************************************************/



/**
 * @extends {Backbone.Collection}
 * @constructor
 */
fmb.models.DeviceCollection = fmb.Collection.extend({
  model: fmb.models.Device
});


/** @inheritDoc */
fmb.models.DeviceCollection.prototype.initialize = function() {
  fmb.Collection.prototype.initialize.apply(this, arguments);
  this.on('add', this.onAdd_, this);
  this.on('remove', this.onRemove_, this);
};


/**
 * @param {Backbone.Model} model A model.
 * @private
 */
fmb.models.DeviceCollection.prototype.onAdd_ = function(model) {
  var uuid = fmb.models.DeviceUnMapped.getUuid();
  if (uuid == model.get('uuid')) {
    fmb.log('fmb.models.DeviceCollection ONADD USER DEVICE!', model.toJSON());
    this.parent.setUserDevice(model);
  }
};


/**
 * @param {Backbone.Model} model A model.
 * @private
 */
fmb.models.DeviceCollection.prototype.onRemove_ = function(model) {
  if (!model.id) {
    return;
  }
  model.save(null, {
    url: fmb.models.getApiUrl('/device/delete'),
    success: _.bind(function() {
      fmb.log('fmb.models.DeviceCollection MONEY TRAIN w/ remove',
              model.id);
      this.parent.saveToStorage();
    }, this),
    error: function(model, xhr, options) {
      fmb.log('FAIL removing ', model.id, xhr.status);
    }
  });
};


/******************************************************************************/



/**
 * @extends {Backbone.Collection}
 * @constructor
 */
fmb.models.FollowingUser = fmb.Model.extend({
  submodels: {
    'devices': fmb.models.DeviceCollection
  }
});


/**
 * Extended to get the avatar_url img hack in.
 * @inheritDoc
 */
fmb.models.FollowingUser.prototype.getTemplateData = function() {
  return fmb.models.User.prototype.getTemplateData.call(this);
};


/******************************************************************************/



/**
 * @extends {Backbone.Collection}
 * @constructor
 */
fmb.models.FollowingCollection = fmb.Collection.extend({
  //localStorage: new Backbone.LocalStorage('FollowingCollection'),
  model: fmb.models.FollowingUser
});


/** @inheritDoc */
fmb.models.FollowingCollection.prototype.initialize = function() {
  fmb.Collection.prototype.initialize.apply(this, arguments);
  this.on('add', this.onAdd_, this);
  this.on('remove', this.onRemove_, this);
};


/**
 * @return {string}
 */
fmb.models.FollowingCollection.prototype.url = function() {
  return fmb.models.getApiUrl('/following');
};


/** @inheritDoc */
fmb.models.FollowingCollection.prototype.parse = function(response, xhr) {
  //fmb.log('fmb.models.FollowingCollection parse', response);
  var obj = fmb.Model.prototype.parse.apply(this, arguments);
  return obj['following'] ? obj['following'] : obj;
};


/**
 * @param {string} uniqueProfileStr A uniqueProfileStr to follow.
 */
fmb.models.FollowingCollection.prototype.addByUniqueProfileStr =
    function(uniqueProfileStr) {
  fmb.log('fmb.models.FollowingCollection addByUniqueProfileStr',
          uniqueProfileStr);

  // Can't follow yerself or no one.
  if (uniqueProfileStr === '' ||
      uniqueProfileStr == this.parent.get('unique_profile_str')) {
    fmb.log('fmb.models.FollowingCollection addByUniqueProfileStr',
            'cant follow yerself');
    return;
  }

  var alreadyFollowing = this.findWhere({
    'unique_profile_str': uniqueProfileStr
  });
  if (alreadyFollowing) {
    fmb.log('.. bail, already following', uniqueProfileStr);
    //alert('You are already following ' + uniqueProfileStr);
    return;
  }

  this.add({
    'name': 'Adding ' + uniqueProfileStr,
    'following_user_unique_profile_str': uniqueProfileStr
  });

  fmb.views.showMessage('Adding ' + uniqueProfileStr);
};


/** @inheritDoc */
fmb.models.FollowingCollection.prototype.fetch = function(options) {
  options = options || {};
  // Don't prune our following collection, otherwise we get
  // hosed by eventual consistency.
  if (!('remove' in options)) {
    options['remove'] = false;
  }
  fmb.Collection.prototype.fetch.call(this, options);
};


/**
 * @param {Backbone.Model} model A model.
 * @private
 */
fmb.models.FollowingCollection.prototype.onAdd_ = function(model) {
  if (model.id) {
    fmb.log('fmb.models.FollowingCollection - no onAdd_', model.id,
            'to server, already has id.');
    return;
  }

  fmb.log('fmb.models.FollowingCollection onAdd_',
          model.get('following_user_key'));
  model.save({
    'cid': model.cid
  }, {
    url: fmb.models.getApiUrl('/following'),

    success: _.bind(function() {
      fmb.log('MONEY TRAIN FollowingCollection onAdd_', model.get('name'));
      fmb.views.showMessage('Added ' + model.get('name'));
      this.parent.saveToStorage();
    }, this),

    error: _.bind(function(model, xhr, options) {
      if (xhr.status === 404) {
        fmb.views.showMessage('Failure adding friend.');
        this.remove(model);

      } else if (xhr.status === 409) {
        //alert('already following');
        fmb.log('.. fail, already following this user.');
      }
    }, this)
  });
};


/**
 * @param {Backbone.Model} model A model.
 * @private
 */
fmb.models.FollowingCollection.prototype.onRemove_ = function(model) {
  fmb.log('fmb.models.FollowingCollection - onRemove', model.id);

  // Shouldn't happen.
  if (!model.id) {
    return;
  }

  model.save(null, {
    url: fmb.models.getApiUrl('/following/delete'),
    success: _.bind(function() {
      fmb.log('fmb.models.FollowingCollection MONEY TRAIN w/ remove',
              model.id);
      this.parent.saveToStorage();

      fmb.views.showMessage('Removed ' + model.get('name'));

    }, this),
    error: function(model, xhr, options) {
      fmb.log('FAIL removing ', model.id, xhr.status);
    }
  });
};


/******************************************************************************/



/**
 * @extends {fmb.Model}
 * @constructor
 */
fmb.models.User = fmb.Model.extend({
  localStorage: new Backbone.LocalStorage('User'),
  submodels: {
    'following': fmb.models.FollowingCollection,
    'devices': fmb.models.DeviceCollection
  }
});


/**
 * This is annoyingly a static function because it's passed in to Java as a
 * string.
 * @param {Object} e An object.
 */
fmb.models.User.onPushNotificationGCM = function(e) {
  fmb.log('-------- GCM NOTIFICATION START ----------');
  fmb.log('fmb.models.User.onNotificationGCM', e.event);

  switch (e.event) {

    case 'registered':
      window['app'].model.user.device.save({
        'gcm_push_token': e.regid,
        'app_version': fmb.models.App.version
      });
      break;

    case 'message':
      // if this flag is set, this notification happened while we were
      // in the foreground.
      // you might want to play a sound to get the user's attention,
      // throw up a dialog, etc.
      if (e.foreground) {
        fmb.log('FOREGROUND NOTIFICATION', e.payload);
        window.navigator.notification.alert(
            e.payload.message,
            function() {},
            'Alert',
            'OK');

      // otherwise we were launched because the user touched a
      // notification in the notification tray.
      } else {
        if (e.coldstart) {
          fmb.log('COLDSTART NOTIFICATION');
        } else {
          fmb.log('BACKGROUND NOTIFICATION');
        }

        fmb.log('PAYLOAD', e.payload);

        if (e.payload.url) {
          window['app'].checkIntentUrlForUser(e.payload.url);
        }
      }

      break;

    case 'error':
      fmb.log('ERROR');
      break;

    default:
      fmb.log('UNKNOWN ERROR');
      break;
  }
  fmb.log('-------- GCM NOTIFICATION END ----------');
};


/** @inheritDoc */
fmb.models.User.prototype.initialize = function(opt_data, opt_options) {
  fmb.Model.prototype.initialize.apply(this, arguments);
  if (this.id) {
    this.doLaunchSync_ = true;
  }

  // API Token will always fire change, even when init'ing from localStorage.
  this.once('change:api_token', this.initialize_, this);
};


/**
 * @return {string} The user's profile link.
 */
fmb.models.User.prototype.getProfileUrl = function() {
  return fmb.models.getServerShare().
      replace('http://', '') + '/p/' + this.get('unique_profile_str');
};


/** @inheritDoc */
fmb.models.User.prototype.getTemplateData = function() {
  var templateData = fmb.Model.prototype.getTemplateData.call(this);

  // Adds size param in google avatar_url so we don't download a huge beast.
  if (this.has('avatar_url') && this.get('avatar_url')) {
    templateData['avatar_url'] =
        templateData['avatar_url'].replace(/\/([^\/]+)$/, '/s100/$1');
  }

  return templateData;
};


/**
 * This method actually does everything to get us set up.
 * @private
 */
fmb.models.User.prototype.initialize_ = function() {
  fmb.log('fmb.models.User initialize_', this.id, this.get('api_token'));
  fmb.models.sync.apiToken = this.get('api_token');
  this.setUserKey_();

  // NOT first-timer.
  if (this.doLaunchSync_) {
    this.launchSync_();

  // Aka first timer in initialize_ needs to create user device.
  } else if (!this.device) {
    this.createUserDevice();
  }
};


/**
 * @private
 */
fmb.models.User.prototype.setUserKey_ = function() {
  fmb.log('fmb.models.User setUserKey saved to localStorage:', this.id,
          'and set for fmb.models.sync.userKey');
  localStorage.setItem('user_key', this.id);
  fmb.models.sync.userKey = this.id;
};


/**
 * Get us all set up.
 */
fmb.models.User.prototype.createUserDevice = function() {
  // We only create a user device if running in an "app" context. Otherwise
  // we might just want to show/run the UI as though we're a client
  // in a browser with no background services (aka the web).
  if (!(fmb.ua.IS_APP || fmb.ua.isSimulator())) {
    fmb.log('**** NOT createUserDevice - is not app or sim.');
    return;
  }

  fmb.log('** CREATE USER DEVICE the first time');

  var device = new fmb.models.Device(null, {
    isUserDevice: true
  });
  var platform = window.device && window.device.platform || navigator.platform;
  var name = window.device && window.device.model || navigator.appName;
  fmb.views.showSpinner('Setting up ' + platform + ' ' + name + ' ...');
  device.saveToServer({
    'uuid': fmb.models.DeviceUnMapped.getUuid(),
    'name': name,
    'platform': platform,
    'app_version': fmb.models.App.version,
    'version': window.device && window.device.version || navigator.productSub
  }, {
    success: _.bind(function() {
      fmb.log('SUCCESS creating user device =)', device);
      fmb.views.hideSpinner();
      this.get('devices').add(device);
    }, this),
    error: function() {
      fmb.log('ERROR creating user device =(');
      fmb.views.hideSpinner();
      alert('I am so sorry that failed. Try killing and restarting the app.');
    }
  });
};


/**
 * Fetch all from the server if the user model has an id
 * which is only true when the user has previously authenticated
 * and been fully set up.
 * @private
 */
fmb.models.User.prototype.launchSync_ = function() {
  // Deferred so model references are set on window.app.
  _.defer(_.bind(function() {
    fmb.log('fmb.models.User launchSync fmb.App.launchedWithAddUserBit?',
            fmb.App.launchedWithAddUserBit);
    this.fetch({
      // --hard RESET sync to server.
      remove: fmb.App.launchedWithAddUserBit ? false : true,

      // Need to fake a battery status after user sync so we don't
      // show out of date info for the user.
      success: _.bind(function(model) {
        fmb.log('User launch sync fetch MONEY TRAIN');
        if (this.device) {
          this.device.trigger('battery_status');

        } else {
          fmb.log('FIX-O-LICIOUS - createUserDevice');
          this.createUserDevice();
        }

      }, this)
    });

    // Our user API doesn't return following data.
    this.get('following').fetch({
      remove: fmb.App.launchedWithAddUserBit ? false : true
    });

  }, this));
};


/**
 * The GCM sender_id from the Google Play store.
 * @type {string}
 */
fmb.models.User.GCM_SENDER_ID = '652605517304';


/**
 * @private
 */
fmb.models.User.prototype.registerWithGCM_ = function() {
  var pushPlugin = window.plugins.pushNotification;
  if (!pushPlugin || !window.device.platform) {
    fmb.log('No push plugin available.');
    return;
  }

  // Android GCM register.
  if (window.device.platform.toLowerCase() == 'android') {
    pushPlugin.register(
        _.bind(this.GCMWin, this),
        _.bind(this.GCMFail, this),
        {
          'senderID': fmb.models.User.GCM_SENDER_ID,
          'ecb': 'fmb.models.User.onPushNotificationGCM'
        });

  // iOS style
  } else {
    /*
    pushPlugin.register(tokenHandler, errorHandler, {
      "badge":"true",
      "sound":"true",
      "alert":"true",
      "ecb":"onNotificationAPN"
    });
    */
  }
};


/**
 * Copied from marknutter's example.
 * @param {Object} e An object.
 */
fmb.models.User.prototype.GCMWin = function(e) {
  fmb.log('fmb.models.User GCMWin!', e);
};


/**
 * Copied from marknutter's example.
 * @param {Object} e An object.
 */
fmb.models.User.prototype.GCMFail = function(e) {
  fmb.log('fmb.models.User GCMFail =(', e);
};


/**
 * @param {fmb.models.Device} model A model instance.
 */
fmb.models.User.prototype.setUserDevice = function(model) {
  this.device = model;
  this.device.on('battery_status', this.device.onBatteryStatus, this.device);

  if (this.get('api_token')) {
    fmb.log('START levelsplugin!');
    var plugin = cordova.require(fmb.App.LEVELS_PLUGIN_ID);
    plugin && plugin.startService();
  }

  this.registerWithGCM_();
};


/**
 * @return {string}
 */
fmb.models.User.prototype.url = function() {
  return fmb.models.getApiUrl('/user');
};


/**
 * @param {string=} opt_token A token.
 */
fmb.models.User.prototype.setLoginToken = function(opt_token) {
  this.loginToken_ = opt_token || fmb.models.getUid();
};


/**
 * The login flow has us using a string token that gets saved into
 * memcache on the server so we can map the user who opens the popup
 * to this user.
 */
fmb.models.User.prototype.syncByLoginToken = function() {
  fmb.log('fmb.models.User syncByLoginToken', this.loginToken_);

  if (!this.loginToken_) {
    fmb.log('no loginToken_!');
    return;
  }

  fmb.views.showSpinner('Synchronizing ...');
  this.saveToServer({
    'user_token': this.loginToken_,
    'app_version': fmb.models.App.version
  }, {
    url: fmb.models.getApiUrl('/user/token'),
    success: _.bind(function(model, response, options) {
      fmb.log('fmb.models.User syncByLoginToken MONEY TRAIN!!');
      fmb.views.hideSpinner();
      this.unset('user_token', {silent: true});
      // unset - can only use this one time.
      this.loginToken_ = null;
    }, this),
    error: function(model, xhr, options) {
      fmb.views.hideSpinner();
      alert('LA BOMBA in syncByLoginToken. =( ' +
            'Try killing the app and starting again. Sorry.');
    }
  });

};


/**
 * Post in-app-auth we receive a callback from chrome.identity with a
 * one-time-use code to obtain auth credentials with on our server.
 * @param {string} code The one-time-use token exchange code.
 */
fmb.models.User.prototype.exchangeGoogleOneTimeAuthCode = function(code) {
  fmb.log('fmb.models.User exchangeGoogleOneTimeAuthCode', code);
  fmb.views.showSpinner('Synchronizing ...');
  this.setLoginToken(code);
  this.saveToServer({
    'code': code
  }, {
    // Note - this is not an API endpoint.
    url: fmb.models.getServer() + '/auth/google/code_exchange',
    success: _.bind(function(model, response, options) {
      fmb.log('fmb.models.User exchangeGoogleOneTimeAuthCode MONEY TRAIN!!');
      this.invalidateGoogleOneTimeAuthCode(code);
      fmb.views.hideSpinner();
    }, this),
    error: _.bind(function(model, xhr, options) {
      fmb.log('LA BOMBA in exchangeGoogleOneTimeAuthCode =(');
      this.invalidateGoogleOneTimeAuthCode(code);
      fmb.views.hideSpinner();
    }, this)
  });
};


/**
 * Post in-app-auth we receive a callback from chrome.identity with a
 * one-time-use code to obtain auth credentials with on our server.
 * @param {string} code The one-time-use token exchange code.
 */
fmb.models.User.prototype.invalidateGoogleOneTimeAuthCode = function(code) {
  fmb.log('invalidateGoogleOneTimeAuthCode', code);
  if (chrome && chrome.identity && code) {
    chrome.identity.removeCachedAuthToken(
        { 'token': code },
        function() {
          fmb.log('Success invalidating Google one-time token', code);
        },
        function() {
          fmb.log('ERROR invalidating Google one-time token', code);
        });
  }
};
