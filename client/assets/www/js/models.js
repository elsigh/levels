

// Yep, we need zepto to work with CORS and cookies.
$.ajaxSettings['beforeSend'] = function(xhr, settings) {
  xhr.withCredentials = true;
  $('.fmb-app > .fmb-loading').show();
};

$.ajaxSettings['complete'] = function(xhr, status) {
  $('.fmb-app > .fmb-loading').hide();
};

/*
$.ajaxSettings['success'] = function(xhr, status) {
  // noop
};
$.ajaxSettings['error'] = function(xhr, status) {
  // noop
};
*/


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

  // id is necessary for localStorage plugin with a model.
  var userKey = localStorage.getItem('user_key');
  fmb.log('userKey from localStorage', userKey);
  if (userKey) {
    this.user = new fmb.models.User({
      id: userKey,
      key: userKey
    });
    this.user.fetchFromStorage();
  } else {
    this.user = new fmb.models.User();
  }

  var deviceKey = localStorage.getItem('device_key');
  fmb.log('deviceKey from localStorage', deviceKey);
  if (deviceKey) {
    this.user.device = new fmb.models.Device({
      id: deviceKey,
      key: deviceKey
    }, {
      isUserDevice: true
    });
    this.user.device.fetchFromStorage();
  } else {
    this.user.device = new fmb.models.Device({
      'uuid': window.device && window.device.uuid || navigator.appVersion,
      'name': window.device && window.device.name || navigator.appName,
      //'model': window.device && window.device.model || navigator.vendor,
      'platform': window.device && window.device.platform || navigator.platform,
      'version': window.device && window.device.version || navigator.productSub
    }, {
      isUserDevice: true
    });
  }

  // Booya for cyclical refs.
  this.user.device.user = this.user;

  // Get the device into the user's "devices" collection if not there already.
  this.user.get('devices').add(this.user.device);

  // Fetch all from the server if the user model has an id
  // which is only true when the user has previously authenticated
  // and been fully set up.
  if (this.user.id) {
    // Deferred so model references are set on window.app.
    _.defer(_.bind(function() {
      this.user.fetch();
    }, this));

  } else {
    this.user.once('change:key', _.bind(function() {
      fmb.log('** SAVE DEVICE for the first time');
      this.user.device.saveToServer();
    }, this));
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
}


/** @inheritDoc */
fmb.models.NotifyingCollection.prototype.url = function() {
  return fmb.models.getApiUrl('/notifying');
};


/** @inheritDoc */
fmb.models.NotifyingCollection.prototype.parse = function(response, xhr) {
  fmb.log('fmb.models.NotifyingCollection parse', response);
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
  if (alreadyNotifying.length) {
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
  fmb.log('fmb.models.NotifyingCollection onAdd:',
           model.id, model.get('means'));

  if (model.id) {
    fmb.log('fmb.models.NotifyingCollection - no need to save', model.id,
            'to server, already has id.');
    return;
  }

  model.save({
    'device_key': this.parent.id,
    'cid': model.cid
  }, {
    success: _.bind(function() {
      fmb.log('MONEY TRAIN save success w/ notify model', model.get('key'));
    }, this),
    wait: true
  });

};


/**
 * @param {string} means A means of contact.
 */
fmb.models.NotifyingCollection.prototype.removeByMeans = function(means) {
  var notifyModel = this.findWhere({'means': means.toString()});
  fmb.log('fmb.models.NotifyingCollection removeByMeans', means,
          notifyModel);
  this.remove(notifyModel);
};


/**
 * @param {fmb.Model} model A notifying model.
 * @private
 */
fmb.models.NotifyingCollection.prototype.onRemove_ = function(model) {
  if (!model.get('key')) {
    fmb.log('fmb.models.NotifyingCollection onRemove no need',
            'w/out key from server.', model.get('means'));
    return;
  }

  model.save(null, {
    url: fmb.models.getApiUrl('/notifying/delete')
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


/******************************************************************************/



/**
 * @extends {fmb.Model}
 * @constructor
 */
fmb.models.DeviceUnMapped = fmb.Model.extend({
  localStorage: new Backbone.LocalStorage('Device'),
  defaults: {
    'user_agent_string': window.navigator.userAgent,
    'update_enabled': 1,
    'update_frequency': 10,
    'notify_level': 10
  },
  submodels: {
    'notifying': fmb.models.NotifyingCollection,
    'settings': fmb.models.SettingsCollection
  }
});


/** @inheritDoc */
fmb.models.DeviceUnMapped.prototype.initialize = function(opt_data, opt_options) {
  fmb.Model.prototype.initialize.apply(this, arguments);
  var options = opt_options || {};

  if (options.isUserDevice) {
    this.on('battery_status', this.onBatteryStatus_, this);
    this.once('change:key', function() {
      fmb.log('fmb.models.MyDevice saved device_key to localStorage:', this.id,
              'and set for fmb.models.sync');
      localStorage.setItem('device_key', this.id);

      if (this.user.get('api_token')) {
        fmb.log('fmb.models.MyDevice START phonediedservice plugin!');
        var plugin = cordova.require('cordova/plugin/phonediedservice');
        plugin && plugin.startService();
      }
    }, this);
  }
};


/**
 * @private
 */
fmb.models.DeviceUnMapped.prototype.onBatteryStatus_ = function() {
  var setting = new fmb.Model({
    'created': fmb.models.getISODate(),
    'battery_level': window.navigator.battery.level,
    'is_charging': window.navigator.battery.isPlugged
  });
  fmb.log('fmb.models.Device onBatteryStatus_ unshift', setting.toJSON());
  this.get('settings').unshift(setting);
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
 * @return {Object} Template data
 */
fmb.models.DeviceUnMapped.prototype.getTemplateData = function() {
  var templateData = fmb.Model.prototype.getTemplateData.call(this);
  // Converts 0 to no-key for mustache falsitude.
  if (!templateData['update_enabled']) {
    delete templateData['update_enabled'];
  }
  return templateData;
};


fmb.models.Device = Backbone.IdentityMap(
    fmb.models.DeviceUnMapped);


/******************************************************************************/


/**
 * DEPRECATED - unless we ever want to allow config of update freq.
 * @private
fmb.models.MyDevice.prototype.onChange_ = function() {
  var changedAttributes = this.changedAttributes();
  fmb.log('fmb.models.MyDevice onChange_');
  var plugin = cordova.require('cordova/plugin/phonediedservice');
  if (plugin && changedAttributes) {

    if ((_.has(changedAttributes, 'update_enabled') ||
         _.has(changedAttributes, 'update_frequency')) &&
        this.has('created')) {

      fmb.log('Device onChange update_enabled CHANGED');
      if (this.get('update_enabled')) {
        plugin.startService(function() {fmb.log('win'); },
                            function(err) { fmb.log('lose', err); });
      } else {
        plugin.stopService(function() {fmb.log('win'); },
                           function(err) { fmb.log('lose', err); });
      }

    // First time device install, start the service.
    } else if (_.has(changedAttributes, 'id')) {
      fmb.log('Device change:key FIRST TIME.', this.id);
      localStorage.setItem('device_key', this.id);
      plugin.startService();
    }

  }
};
*/


/******************************************************************************/



/**
 * @extends {Backbone.Collection}
 * @constructor
 */
fmb.models.DeviceCollection = fmb.Collection.extend({
  model: fmb.models.Device
});


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


/******************************************************************************/



/**
 * @extends {Backbone.Collection}
 * @constructor
 */
fmb.models.FollowingCollection = fmb.Collection.extend({
  //localStorage: new Backbone.LocalStorage('FollowingCollection'),
  model: fmb.models.FollowingUser
});


/**
 * @return {string}
 */
fmb.models.FollowingCollection.prototype.url = function() {
  return fmb.models.getApiUrl('/following');
};


/** @inheritDoc */
fmb.models.FollowingCollection.prototype.parse = function(response, xhr) {
  fmb.log('fmb.models.FollowingCollection parse', response);
  var obj = fmb.Model.prototype.parse.apply(this, arguments);
  return obj['following'] ? obj['following'] : obj;
};


/**
 * @param {string} userKey A userKey to follow.
 */
fmb.models.FollowingCollection.prototype.addByKey = function(userKey) {
  fmb.log('fmb.models.FollowingCollection addByKey', userKey);

  // Can't follow yerself or no one.
  if (userKey === '' ||
      userKey == this.parent.get('key')) {
    fmb.log('fmb.models.FollowingCollection addByKey cant follow yoself');
    return;
  }

  var alreadyFollowing = this.findWhere({
    key: userKey
  });
  if (alreadyFollowing.length) {
    fmb.log('.. bail, already following', userKey);
    alert('You are already following ' + userKey);
    return;
  }

  this.add({
    'name': 'Adding w/' + userKey
  });
};


/**
 * @param {Backbone.Model} model A follow user model.
 * @private
 */
fmb.models.FollowingCollection.prototype.onAdd_ = function(model) {
  model.save({
    'following_user_key': userKey,
    'cid': this.cid
  }, {
    wait: true,
    url: fmb.models.getApiUrl('/following'),
    success: _.bind(function() {
      fmb.log('MONEY TRAIN FollowingCollection onAdd_.');
      //this.fetch();
    }, this),
    error: function(model, xhr, options) {
      if (xhr.status === 404) {
        alert('La bomba, seems we could not find a user ' + userKey);
      } else if (xhr.status === 409) {
        //alert('already following');
      }
    }
  });
};


/**
 * @param {string} userKey A userKey to follow.
 */
fmb.models.FollowingCollection.prototype.removeByKey = function(userKey) {
  var followModel = this.findWhere({
    key: userKey
  });
  this.remove(followModel);
};


/**
 * @param {Backbone.Model} followModel A follow user model.
 * @private
 */
fmb.models.FollowingCollection.prototype.onRemove_ = function(followModel) {
  followModel.save(null, {
    url: fmb.models.getApiUrl('/following/delete/'),
    success: _.bind(function() {
      fmb.log('MONEY TRAIN w/ removeByKey', userKey);
    }, this),
    error: function(model, xhr, options) {
      fmb.log('FAIL removing ', userKey, xhr.status);
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


/** @inheritDoc */
fmb.models.User.prototype.initialize = function(opt_data, opt_options) {
  fmb.Model.prototype.initialize.apply(this, arguments);
  if (this.id) {
    this.setUserKey_();
  } else {
    this.once('change:key', this.setUserKey_, this);
  }

  // API Token will always fire change, even when init'ing from localStorage.
  this.once('change:api_token', function() {
    fmb.log('Set API token for fmb.models.sync', this.get('api_token'));
    fmb.models.sync.apiToken = this.get('api_token');

    var plugin = cordova.require('cordova/plugin/phonediedservice');
    if (this.device.id && plugin) {
      fmb.log('fmb.models.MyDevice got API token, start plugin service!');
      plugin.startService();
    }
  }, this);
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
 * @return {string}
 */
fmb.models.User.prototype.url = function() {
  return fmb.models.getApiUrl('/user');
};


/**
 * The login flow has us using a string token that gets saved into
 * memcache on the server so we can map the user who opens the popup
 * to this user.
 * @param {string} token A login request token.
 */
fmb.models.User.prototype.syncByToken = function(token) {
  fmb.log('fmb.models.User syncByToken', token);

  this.saveToServer({
    'user_token': token
  }, {
    url: fmb.models.getApiUrl('/user/token'),
    success: _.bind(function(model, response, options) {
      fmb.log('fmb.models.User syncByToken MONEY TRAIN!!', response);
      this.unset('user_token', {silent: true});
    }, this),
    error: function(model, xhr, options) {
      alert('LA BOMBA');
    }
  });
};



