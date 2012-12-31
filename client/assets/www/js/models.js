

/**
 * @type {Object} Models namespace.
 */
fmb.models = {};


/**
 * @type {string}
 */
fmb.models.SERVER_LOCAL = 'http://192.168.1.9:9091';


/**
 * @type {string}
 */
fmb.models.SERVER_PROD = 'http://www.followmybattery.com';


/**
 * @type {string}
 */
fmb.models.SERVER = window.location.protocol == 'http:' ?
    fmb.models.SERVER_LOCAL : fmb.models.SERVER_PROD;


/**
 * @return {string} An url.
 */
fmb.models.getApiUrl = function(endpoint) {
  return fmb.models.SERVER + '/api' + endpoint;
};


/**
 * @return {string} A uuid, ripped from lawnchair/Backbone.localstorage.js.
 */
fmb.models.getUid = function() {
  var S4 = function() {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };
  return (S4() + S4() + '-' + S4() + '-' + S4() + '-' + S4() +
          '-' + S4() + S4() + S4());
};


/**
 * @param {number} time An ISO time.
 */
fmb.models.prettyDate = function(time){
  var date = new Date(time),
    diff = (((new Date()).getTime() - date.getTime()) / 1000),
    day_diff = Math.floor(diff / 86400);

  if ( isNaN(day_diff) || day_diff < 0 || day_diff >= 31 )
    return;

  return day_diff === 0 && (
      diff < 60 && "just now" ||
      diff < 120 && "1 minute ago" ||
      diff < 3600 && Math.floor( diff / 60 ) + " minutes ago" ||
      diff < 7200 && "1 hour ago" ||
      diff < 86400 && Math.floor( diff / 3600 ) + " hours ago") ||
    day_diff == 1 && "Yesterday" ||
    day_diff < 7 && day_diff + " days ago" ||
    day_diff < 31 && Math.ceil( day_diff / 7 ) + " weeks ago";
};


/** @inheritDoc */
fmb.models.sync = function(method, model, options) {
  options = options ? _.clone(options) : {};

  if (options['local_storage_only']) {
    console.log('sync, but local storage only');
    return;
  }

  // Ensure JSON content-type.
  options.contentType = 'application/json; charset=utf8';

  // Includes our auth token in requests.
  if (fmb.models.sync.authToken) {
    if ((method == 'update') || (method == 'create') || (method == 'delete')) {
      var data = model.toJSON();  // Typical Backbone.
      data['auth_token'] = fmb.models.sync.authToken;
      options.data = JSON.stringify(data);
    } else {
      options.data = {
        'auth_token': fmb.models.sync.authToken
      };
    }
  }
  console.log('AJAX SYNC', method, model.url());
  Backbone.ajaxSync.call(this, method, this, options);
};


/**
 * @type {string}
 */
fmb.models.sync.authToken = null;


// All sync calls do double duty.
Backbone.sync = function() {
  Backbone.localSync.apply(this, arguments);
  return fmb.models.sync.apply(this, arguments);
};


/******************************************************************************/



/**
 * @extends {Backbone.Model}
 * @constructor
 */
fmb.models.App = Backbone.Model.extend();


/** @inheritDoc */
fmb.models.App.prototype.initialize = function() {
  console.log('fmb.models.App.initialize');

  // id is necessary for localStorage plugin with a model.
  var profileUid = localStorage.getItem('profile_uid');
  var doFetch = true;
  if (!profileUid) {
    doFetch = false;
    profileUid = fmb.models.getUid();
    localStorage.setItem('profile_uid', profileUid);
  }

  this.profile = new fmb.models.Profile({
    id: profileUid
  });

  var deviceUid = localStorage.getItem('device_uid');
  if (!deviceUid) {
    deviceUid = window.device && window.device.uuid || fmb.models.getUid();
    localStorage.setItem('device_uid', deviceUid);
  }
  this.device = new fmb.models.Device({
    'id': deviceUid,
    'uuid': deviceUid,
    'name': window.device && window.device.name || navigator.appName,
    'platform': window.device && window.device.platform || navigator.platform,
    'version': window.device && window.device.version || navigator.appVersion
  });

  this.notifying = new fmb.models.NotifyingCollection([], {
    profile: this.profile
  });

  this.following = new fmb.models.FollowingCollection([], {
    profile: this.profile
  });

  if (doFetch) {
    // Deferred so model references are set on window.app.
    _.defer(_.bind(function() {
      this.profile.fetch();
      this.device.fetch();
      //this.notifying.fetch();
      this.following.fetch();
    }, this));
  }
};


/******************************************************************************/



/**
 * @extends {Backbone.Model}
 * @constructor
 */
fmb.Model = Backbone.Model.extend();


/**
 * @return {Object} A template data object.
 */
fmb.Model.prototype.getTemplateData = function() {
  var templateData = {};
  _.each(this.toJSON(), function(val, key) {
    if (val) {
      templateData[key] = val;
    }
  });
  return templateData;
};


/** @inheritDoc */
fmb.Model.prototype.parse = function(response, xhr) {
  //console.log('..parse')

  if (response['auth_token'] && !fmb.models.sync.authToken) {
    //console.log('SETTING AUTH TOKEN')
    fmb.models.sync.authToken = response['auth_token'];
  }

  // Always store server data to localStorage.
  if (response['status'] === 0) {
    _.defer(_.bind(function() {
      //console.log('storing local data', response)
      this.saveToStorage();
    }, this));
  }
  delete response['status'];  // Not for model data.

  return response;
};


fmb.Model.prototype.saveToStorage = function() {
  Backbone.localSync('update', this);
};


fmb.Model.prototype.fetchFromStorage = function(opt_options) {
  var options =_.clone(opt_options) || {};
  options = _.extend(options, {
    success: _.bind(function(resp) {
      this.set(resp, opt_options);
    }, this)
  });
  Backbone.localSync('read', this, options);
};


/******************************************************************************/



/**
 * @extends {fmb.Model}
 * @constructor
 */
fmb.models.Profile = fmb.Model.extend({
  localStorage: new Backbone.LocalStorage("Profile")
});


/** @inheritDoc */
fmb.models.Profile.prototype.initialize = function(options) {
  this.once('change:auth_token', function() {
    fmb.models.sync.authToken = this.get('auth_token');
  }, this);
};


/**
 * @return {string}
 */
fmb.models.Profile.prototype.url = function() {
  var username = this.has('username') ? this.get('username') : '';
  return fmb.models.getApiUrl('/profile/' + username);
};


/******************************************************************************/



/**
 * @extends {fmb.Model}
 * @constructor
 */
fmb.models.AjaxSyncModel= Backbone.Model.extend({
  sync: fmb.models.sync
});


/******************************************************************************/



/**
 * @extends {fmb.Model}
 * @constructor
 */
fmb.models.ProfileNameChecker = Backbone.Model.extend({
  sync: Backbone.ajaxSync
});


/**
 * @return {string}
 */
fmb.models.ProfileNameChecker.prototype.url = function() {
  return fmb.models.Profile.prototype.url.call(this);
};


/******************************************************************************/



/**
 * @extends {fmb.Model}
 * @constructor
 */
fmb.models.Device = fmb.Model.extend({
  localStorage: new Backbone.LocalStorage("Device"),
  defaults: {
    'user_agent_string': window.navigator.userAgent,
    'update_enabled': 1,
    'update_frequency': 10
  }
});


/** @inheritDoc */
fmb.models.Device.prototype.initialize = function(options) {
  this.fetchFromStorage({silent: true});
  this.on('change', this.onChange_, this);
};


/**
 * @private
 */
fmb.models.Device.prototype.onChange_ = function() {
  var plugin = cordova.require('cordova/plugin/phonediedservice');
  var changedAttributes = this.changedAttributes();
  console.log('Device onChange_', changedAttributes);
  if (plugin && changedAttributes) {

    if ((_.has(changedAttributes, 'update_enabled') ||
         _.has(changedAttributes, 'update_frequency')) &&
        this.has('created')) {

      console.log('Device onChange update_enabled CHANGED');
      if (this.get('update_enabled')) {
        plugin.startService(function() {console.log('win'); },
                            function(err) { console.log('lose', err); });
      } else {
        plugin.stopService(function() {console.log('win'); },
                           function(err) { console.log('lose', err); });
      }

    // First time device install, start the service.
    } else if (_.has(changedAttributes, 'created')) {
      console.log('Device onChange FIRST TIME - start service.');
      plugin.startService(function() {console.log('win'); },
                          function(err) { console.log('lose', err); });
    }

  }
};


/**
 * @return {string} An url.
 */
fmb.models.Device.prototype.url = function() {
  return fmb.models.getApiUrl('/device/' + this.get('uuid'));
};


/**
 * @return {Object} Template data
 */
fmb.models.Device.prototype.getTemplateData = function() {
  var templateData = fmb.Model.prototype.getTemplateData.call(this);
  // Converts 0 to no-key for mustache falsitude.
  if (!templateData['update_enabled']) {
    delete templateData['update_enabled'];
  }
  return templateData;
};


/******************************************************************************/



/**
 * @extends {Backbone.Collection}
 * @constructor
 */
fmb.models.NotifyingCollection = Backbone.Collection.extend({
  localStorage: new Backbone.LocalStorage("NotifyingCollection")
});


/**
 * @return {string}
 */
fmb.models.NotifyingCollection.prototype.initialize =
    function(models, options) {
  this.profile = options.profile;
};


/**
 * @return {string}
 */
fmb.models.NotifyingCollection.prototype.url = function() {
  return fmb.models.getApiUrl('/notifying/') + this.profile.get('username');
};


/******************************************************************************/



/**
 * @extends {Backbone.Collection}
 * @constructor
 */
fmb.models.FollowingCollection = Backbone.Collection.extend({
  localStorage: new Backbone.LocalStorage("FollowingCollection")
});


/**
 * @return {string}
 */
fmb.models.FollowingCollection.prototype.initialize =
    function(models, options) {
  this.profile = options.profile;
};


/** @inheritDoc */
fmb.models.FollowingCollection.prototype.parse = function(response) {
  _.each(response['following'], function(following) {
    _.each(following['devices'], function(device) {
      var createdTs = device['battery']['created'] * 1000;
      device['battery']['created_pretty'] =
          fmb.models.prettyDate(createdTs);

    });
  });
  return response['following'];
};


/**
 * @return {string}
 */
fmb.models.FollowingCollection.prototype.url = function() {
  return fmb.models.getApiUrl('/following/') + this.profile.get('username');
};

