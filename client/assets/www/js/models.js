

// Yep, we need zepto to work with CORS and cookies.
$.ajaxSettings['beforeSend'] = function(xhr, settings) {
  xhr.withCredentials = true;
};
/*
$.ajaxSettings['complete'] = function(xhr, status) {
  // noop
};
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
  var userId = localStorage.getItem('user_id');
  fmb.log('userId from localStorage', userId);
  if (userId) {
    this.user = new fmb.models.User({
      id: userId
    });
    this.user.fetchFromStorage();
  } else {
    this.user = new fmb.models.User();
  }

  var deviceId = localStorage.getItem('device_id');
  fmb.log('deviceId from localStorage', deviceId);
  if (deviceId) {
    this.device = new fmb.models.MyDevice({
      id: deviceId
    });
    this.device.fetchFromStorage();
  } else {
    this.device = new fmb.models.MyDevice({
      'uuid': window.device && window.device.uuid || navigator.appVersion,
      'name': window.device && window.device.name || navigator.appName,
      'platform': window.device && window.device.platform || navigator.platform,
      'version': window.device && window.device.version || navigator.productSub
    });
  }

  // Get the device into the user's devices collection if not there already.
  this.user.get('devices').add(this.device);

  // Fetch all from the server if the user model has an id
  // which is only true when the user has previously authenticated
  // and been fully set up.
  if (this.user.id) {
    // Deferred so model references are set on window.app.
    _.defer(_.bind(function() {
      this.user.fetch();
      this.device.fetch();
    }, this));

  } else {
    this.user.once('change:id', _.bind(function() {
      fmb.log('** SAVE DEVICE for the first time');
      this.device.saveToServer();
    }, this));
  }
};


/******************************************************************************/



/**
 * @extends {Backbone.Collection}
 * @constructor
 */
fmb.models.NotifyingCollection = fmb.Collection.extend({
  //localStorage: new Backbone.LocalStorage('NotifyingCollection'),
  model: fmb.Model
});


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
    'device_id': this.parent.id
  };
  fmb.Collection.prototype.fetch.call(this, options);
}

/**
 * @param {Object} obj A contact object.
 */
fmb.models.NotifyingCollection.prototype.addContact = function(obj) {
  fmb.log('fmb.models.NotifyingCollection addContact:', obj);

  var means = obj['means'];
  if (means === '') {
    return;
  }

  // Adds in the parent device_id.
  obj['device_id'] = this.parent.id;

  var alreadyNotifying = this.find(function(model) {
    return model.get('means') == means;
  });
  if (alreadyNotifying) {
    fmb.log('.. bail, already notifying', means);
    alert('You are already notifying ' + means);
    return;
  }

  var addModel = new fmb.models.AjaxSyncModel();
  addModel.url = _.bind(function() {
    return fmb.models.getApiUrl('/notifying');
  }, this);
  addModel.save(obj, {
    success: _.bind(function() {
      fmb.log('MONEY TRAIN NotifyingCollection, refetching from server.');
      this.fetch();
    }, this),
    error: function(model, xhr, options) {
      if (xhr.status === 404) {
        fmb.log('Gah, serious error in NotifyingCollection addContact');
        alert('La bomba w/ ' + means);
      } else if (xhr.status === 409) {
        //alert('already notifying');
      }
    }
  });
};


/**
 * @param {string} means A means of contact.
 */
fmb.models.NotifyingCollection.prototype.removeByMeans = function(means) {
  var notifyModel = new fmb.models.AjaxSyncModel();

  notifyModel.url = _.bind(function() {
    return fmb.models.getApiUrl('/notifying/delete');
  }, this);

  notifyModel.save({
    'device_id': this.parent.id,
    'means': means.toString()
  }, {
    success: _.bind(function() {
      fmb.log('MONEY TRAIN, refetching notifying data from server.');
      this.fetch();
    }, this),
    error: function(model, xhr, options) {
      fmb.log('FAIL removing ' +  means + ', ' + xhr.status);
    }
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
fmb.models.Device = fmb.Model.extend({
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
fmb.models.Device.prototype.getStorageData = function() {
  var obj = fmb.Model.prototype.getStorageData.call(this);

  // Don't store the long list of historical settings data.
  delete obj['settings'];

  return obj;
};


/** @inheritDoc */
fmb.models.Device.prototype.fetch = function(opt_options) {
  var options = opt_options || {};
  options.data = {
    'device_id': this.id
  };
  fmb.Model.prototype.fetch.call(this, options);
};


/**
 * @return {string} An url.
 */
fmb.models.Device.prototype.url = function() {
  return fmb.models.getApiUrl('/device');
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
 * @extends {fmb.Model}
 * @constructor
 */
fmb.models.MyDevice = fmb.models.Device.extend({
  localStorage: new Backbone.LocalStorage('Device')
});


/** @inheritDoc */
fmb.models.MyDevice.prototype.initialize = function(opt_data, opt_options) {
  fmb.Model.prototype.initialize.apply(this, arguments);
  this.once('change:id', function() {
    fmb.log('Saved device_id to localStorage:', this.id,
            'and set for fmb.models.sync');
    localStorage.setItem('device_id', this.id);
    //fmb.models.sync.deviceId = this.id;

    var plugin = cordova.require('cordova/plugin/phonediedservice');
    if (plugin) {
      plugin.startService();
    }
  }, this);

  /*
  if (this.id) {
    _.defer(function() {
      cordova.require('cordova/plugin/phonediedservice').startService();
    });
  }
  this.on('change', this.onChange_, this);
  */
};


/**
 * DEPRECATED - unless we ever want to allow config of update freq.
 * @private
 */
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
      fmb.log('Device change:id FIRST TIME.', this.id);
      localStorage.setItem('device_id', this.id);
      //fmb.models.sync.deviceId = this.id;
      plugin.startService();
    }

  }
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
fmb.models.FollowingCollection.prototype.parse = function(response, xhr) {
  var obj = fmb.Model.prototype.parse.apply(this, arguments);
  _.each(obj['following'], function(following) {
    _.each(following['devices'], function(device) {
      var createdTs = device['battery']['created'] * 1000;
      device['battery']['created_pretty'] =
          fmb.models.prettyDate(createdTs);
    });
  });
  return obj['following'];
};


/**
 * @param {string} userKey A userKey to follow.
 */
fmb.models.FollowingCollection.prototype.addByUserKey = function(userKey) {
  fmb.log('fmb.models.FollowingCollection addByUserKey', userKey);

  // Can't follow yerself or no one.
  if (userKey === '' ||
      userKey == this.parent.get('key')) {
    fmb.log('fmb.models.FollowingCollection addByUserKey cant follow yoself');
    return;
  }

  var alreadyFollowing = this.find(function(model) {
    return model.get('user')['key'] == userKey;
  });
  if (alreadyFollowing) {
    fmb.log('.. bail, already following', userKey);
    alert('You are already following ' + userKey);
    return;
  }

  var followModel = new fmb.models.AjaxSyncModel();
  followModel.url = _.bind(function() {
    return fmb.models.getApiUrl('/following');
  }, this);
  followModel.save({'user_key': userKey}, {
    //url: url,  // why this no work?
    success: _.bind(function() {
      fmb.log('MONEY TRAIN, refetching following data from server.');
      this.fetch();
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
fmb.models.FollowingCollection.prototype.removeByUsername = function(userKey) {
  var followModel = new fmb.models.AjaxSyncModel();

  followModel.url = _.bind(function() {
    return fmb.models.getApiUrl('/following/delete');
  }, this);

  followModel.save({
    'user_key': userKey
  }, {
    // Why does url not work here?
    //url: fmb.models.getApiUrl('/following/delete/') +
    //     this.parent.get('userKey'),
    success: _.bind(function() {
      fmb.log('MONEY TRAIN, refetching following data from server.');
      this.fetch();
    }, this),
    error: function(model, xhr, options) {
      fmb.log('FAIL removing ', userKey, xhr.status);
    }
  });
};


/**
 * @return {string}
 */
fmb.models.FollowingCollection.prototype.url = function() {
  return fmb.models.getApiUrl('/following');
};


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
  this.once('change:id', function() {
    fmb.log('Saved user_id to localStorage:', this.id,
            'and set for fmb.models.sync');
    localStorage.setItem('user_id', this.id);
    fmb.models.sync.userId = this.id;
  }, this);

  this.once('change:api_token', function() {
    fmb.log('Set API token for fmb.models.sync', this.get('api_token'));
    fmb.models.sync.apiToken = this.get('api_token');
  });
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



