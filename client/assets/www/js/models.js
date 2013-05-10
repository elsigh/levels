

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

/**
 * @type {Object} Models namespace.
 */
fmb.models = {};


/**
 * @type {string}
 */
fmb.models.SERVER_LOCAL = 'http://localhost:8080';


/**
 * @type {string}
 */
fmb.models.SERVER_PROD = 'https://followmybattery.appspot.com';

// Useful for testing from the filesystem locally.
//fmb.models.SERVER_PROD = fmb.models.SERVER_LOCAL;


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
    fmb.log('sync, but local storage only');
    return;
  }

  var url = options.url || model.url();
  if (!url) {
    return;
  }

  // Ensure JSON content-type.
  options.contentType = 'application/json; charset=utf8';

  // Includes our auth token in requests.
  if (fmb.models.sync.userId) {
    if (method == 'update' || method == 'create' || method == 'delete') {
      var data = model.toJSON();  // Typical Backbone.
      data['api_token'] = fmb.models.sync.apiToken;
      data['user_id'] = fmb.models.sync.userId;

      if (fmb.models.sync.deviceId) {
        data['device_id'] = fmb.models.sync.deviceId;
      }
      options.data = JSON.stringify(data);
    } else {
      options.data = {
        'api_token': fmb.models.sync.apiToken,
        'user_id': fmb.models.sync.userId
      };
      if (fmb.models.sync.deviceId) {
        options.data['device_id'] = fmb.models.sync.deviceId;
      }
    }
  }
  fmb.log('---------------> AJAX SYNC', method, url);
  Backbone.ajaxSync.call(this, method, model, options);
};


/**
 * @type {string}
 */
fmb.models.sync.apiToken = null;


/**
 * @type {string}
 */
fmb.models.sync.userId = null;


/**
 * @type {string}
 */
fmb.models.sync.deviceId = null;


// All sync calls do double duty.
Backbone.sync = function() {
  Backbone.LocalStorage.sync.apply(this, arguments);
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
  fmb.log('fmb.models.App.initialize');

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
    this.device = new fmb.models.Device({
      id: deviceId
    });
    this.device.fetchFromStorage();
  } else {
    this.device = new fmb.models.Device({
      'uuid': window.device && window.device.uuid || fmb.models.getUid(),
      'name': window.device && window.device.name || navigator.appName,
      'platform': window.device && window.device.platform || navigator.platform,
      'version': window.device && window.device.version || navigator.appVersion
    });
  }

  this.notifying = new fmb.models.NotifyingCollection(null, {
    user: this.user
  });

  this.following = new fmb.models.FollowingCollection(null, {
    user: this.user
  });

  // Fetch all from the server if the user model has an id
  // which is only true when the user has previously authenticated
  // and been fully set up.
  if (this.user.id) {
    // Deferred so model references are set on window.app.
    _.defer(_.bind(function() {
      this.user.fetch();
      //this.device.fetch();
      //this.following.fetch();
      //this.notifying.fetch();
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
 * @extends {Backbone.Model}
 * @constructor
 */
fmb.Collection = Backbone.Collection.extend();


/** @inheritDoc */
fmb.Collection.prototype.initialize = function(opt_options) {
  //fmb.log('initialize collection')
  this.fetchFromStorage({silent: true});
  this.on('reset', function() {
    this.each(function(model) {
      model.saveToStorage();
    });
  }, this);
};


fmb.Collection.prototype.fetchFromStorage = function(opt_options) {
  // Pretend to be async.
  _.defer(_.bind(function() {
    var results = this.localStorage.findAll();
    //fmb.log('fetchFromStorage:' + JSON.stringify(results));
    this.reset(results, opt_options);
  }, this));
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
  //fmb.log('fmb.Model parse: ' + this.id + ', ' + JSON.stringify(response));

  // Always store server data to localStorage.
  if (response['status'] === 0) {
    _.defer(_.bind(function() {
      //fmb.log('storing local data', response)
      this.saveToStorage();
    }, this));
  }

  delete response['status'];  // Not for model data.

  return response;
};


/**
 * @param {Object=} opt_data Data to save.
 * @param {Object=} opt_options Options config.
 */
fmb.Model.prototype.saveToServer = function(opt_data, opt_options) {
  fmb.log('saveToServer called for id:' + this.id);

  // ghetto!
  Backbone.sync = function() {
    return fmb.models.sync.apply(this, arguments);
  };

  this.save(opt_data, opt_options);

  // ghetto!
  Backbone.sync = function() {
    Backbone.LocalStorage.sync.apply(this, arguments);
    return fmb.models.sync.apply(this, arguments);
  };
};


/**
 * Save me.
 */
fmb.Model.prototype.saveToStorage = function() {
  fmb.log('saveToStorage called for id:' + this.id);
  // ghetto!
  Backbone.sync = function() {
    return Backbone.LocalStorage.sync.apply(this, arguments);
  };

  this.save();

  // ghetto!
  Backbone.sync = function() {
    Backbone.LocalStorage.sync.apply(this, arguments);
    return fmb.models.sync.apply(this, arguments);
  };
};


/**
 * @param {Object=} opt_options Options config.
 */
fmb.Model.prototype.fetchFromStorage = function(opt_options) {
  // Pretend to be async.
  _.defer(_.bind(function() {
    var results = this.localStorage.findAll();
    fmb.log('fetchFromStorage RESULTS:', results);
    if (results.length) {
      this.set(results[results.length - 1], opt_options);
    }
  }, this));
};



/******************************************************************************/



/**
 * @extends {fmb.Model}
 * @constructor
 */
fmb.models.User = fmb.Model.extend({
  localStorage: new Backbone.LocalStorage('User')
});


/** @inheritDoc */
fmb.models.User.prototype.initialize = function(options) {
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
fmb.models.Device = fmb.Model.extend({
  localStorage: new Backbone.LocalStorage('Device'),
  defaults: {
    'user_agent_string': window.navigator.userAgent,
    'update_enabled': 1,
    'update_frequency': 10,
    'notify_level': 10
  }
});


/** @inheritDoc */
fmb.models.Device.prototype.initialize = function(options) {
  if (this.id) {
    _.defer(function() {
      cordova.require('cordova/plugin/phonediedservice').startService();
    });
  }
  this.on('change', this.onChange_, this);
};


/**
 * @private
 */
fmb.models.Device.prototype.onChange_ = function() {
  var plugin = cordova.require('cordova/plugin/phonediedservice');
  var changedAttributes = this.changedAttributes();
  fmb.log('Device onChange_' +  JSON.stringify(changedAttributes));

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
      plugin.startService();
    }

  }
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
 * @extends {Backbone.Collection}
 * @constructor
 */
fmb.models.NotifyingCollection = fmb.Collection.extend({
  localStorage: new Backbone.LocalStorage('NotifyingCollection'),
  model: fmb.Model
});


/** @inheritDoc */
fmb.models.NotifyingCollection.prototype.initialize =
    function(models, options) {
  fmb.Collection.prototype.initialize.call(this);
  this.user = options.user;
};


/** @inheritDoc */
fmb.models.NotifyingCollection.prototype.url = function() {
  return fmb.models.getApiUrl('/notifying');
};


/** @inheritDoc */
fmb.models.NotifyingCollection.prototype.parse = function(response) {
  return response['notifying'];
};


/**
 * @param {Object} obj A contact object.
 */
fmb.models.NotifyingCollection.prototype.addContact = function(obj) {
  fmb.log('addContact:', obj);

  var means = obj['means'];
  if (means === '') {
    return;
  }

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
      fmb.log('MONEY TRAIN, refetching goodies from server.');
      this.fetch();
    }, this),
    error: function(model, xhr, options) {
      if (xhr.status === 404) {
        alert('La bomba, seems we could not find delete ' + means);
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
    return fmb.models.getApiUrl('/notifying/delete/');
  }, this);

  notifyModel.save({
    'means': means
  }, {
    success: _.bind(function() {
      fmb.log('MONEY TRAIN, refetching goodies from server.');
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
fmb.models.FollowingCollection = fmb.Collection.extend({
  localStorage: new Backbone.LocalStorage('FollowingCollection'),
  model: fmb.Model
});


/**
 * @return {string}
 */
fmb.models.FollowingCollection.prototype.initialize =
    function(models, options) {
  fmb.Collection.prototype.initialize.call(this);
  this.user = options.user;
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
 * @param {string} userKey A userKey to follow.
 */
fmb.models.FollowingCollection.prototype.addByUserKey = function(userKey) {
  fmb.log('addByUsername:', userKey);

  // Can't follow yerself or no one.
  if (userKey === '' ||
      userKey == this.user.get('key')) {
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
      fmb.log('MONEY TRAIN, refetching goodies from server.');
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
    //     this.user.get('userKey'),
    success: _.bind(function() {
      fmb.log('MONEY TRAIN, refetching goodies from server.');
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

