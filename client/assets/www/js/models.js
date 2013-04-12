

/**
 * @type {Object} Models namespace.
 */
fmb.models = {};


/**
 * @type {string}
 */
fmb.models.SERVER_LOCAL = 'http://localhost:9091';


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
    fmb.log('sync, but local storage only');
    return;
  }

  var url = model.url();
  if (!url) {
    return;
  }

  // Ensure JSON content-type.
  options.contentType = 'application/json; charset=utf8';

  // Includes our auth token in requests.
  if (fmb.models.sync.authToken) {
    if ((method == 'update') || (method == 'create') || (method == 'delete')) {
      var data = model.toJSON();  // Typical Backbone.
      data['auth_token'] = fmb.models.sync.authToken;
      data['uuid'] = fmb.models.sync.uuid;
      options.data = JSON.stringify(data);
    } else {
      options.data = {
        'auth_token': fmb.models.sync.authToken,
        'uuid': fmb.models.sync.uuid
      };
    }
  }
  fmb.log('AJAX SYNC', method, url);
  Backbone.ajaxSync.call(this, method, model, options);
};


/**
 * @type {string}
 */
fmb.models.sync.authToken = null;


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
  var profileUid = localStorage.getItem('profile_uid');
  fmb.log('profileUid from localStorage', profileUid);
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
  fmb.log('deviceUid from localStorage', deviceUid);
  if (!deviceUid) {
    deviceUid = window.device && window.device.uuid || fmb.models.getUid();

    // Hardcode a stable uuid for testing.
    if (window.location.protocol == 'http:') {
      deviceUid = '6009c94b-5b58-fc7a-391a-491f35afe2dc';
    }

    localStorage.setItem('device_uid', deviceUid);

    // This might work.
    fmb.log('Checking out ProfileDeviceChecker w/uuid', deviceUid);
    var tmp = new fmb.models.ProfileDeviceChecker({
      'uuid': deviceUid
    }).fetch({
      success: _.bind(function(model, response) {
        fmb.log('SUCCESSFULLY FOUND OLD PROFILE: ', response);

        this.profile.clear({silent: true});
        this.profile.set(response['profile']);
        this.profile.saveToStorage();
        localStorage.setItem('profile_uid', this.profile.id);

        this.device.clear({silent: true});
        this.device.set(response['device']);
        this.device.saveToStorage();

        fmb.log('We found an existing account for you =)');
      }, this)
    });
  }

  this.device = new fmb.models.Device({
    'uuid': deviceUid,
    'name': window.device && window.device.name || navigator.appName,
    'platform': window.device && window.device.platform || navigator.platform,
    'version': window.device && window.device.version || navigator.appVersion
  });

  this.notifying = new fmb.models.NotifyingCollection(null, {
    profile: this.profile
  });

  this.following = new fmb.models.FollowingCollection(null, {
    profile: this.profile
  });

  if (doFetch) {
    // Deferred so model references are set on window.app.
    _.defer(_.bind(function() {
      this.profile.fetch();
      this.device.fetch();
      this.following.fetch();
      this.notifying.fetch();
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
  var results = this.localStorage.findAll();
  //fmb.log('fetchFromStorage:' + JSON.stringify(results));
  this.reset(results, opt_options);
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

  if (response['auth_token'] && !fmb.models.sync.authToken) {
    //fmb.log('SETTING AUTH TOKEN')
    fmb.models.sync.authToken = response['auth_token'];
  }

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


fmb.Model.prototype.saveToServer = function() {
  fmb.log('saveToServer called for id:' + this.id);

  // ghetto!
  Backbone.sync = function() {
    return fmb.models.sync.apply(this, arguments);
  };

  this.save();

  // ghetto!
  Backbone.sync = function() {
    Backbone.LocalStorage.sync.apply(this, arguments);
    return fmb.models.sync.apply(this, arguments);
  };
};


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


fmb.Model.prototype.fetchFromStorage = function(opt_options) {
  var results = this.localStorage.findAll();
  if (results.length) {
    this.set(results[results.length - 1], opt_options);
  }
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
  if (!username) {
    fmb.log('No username, no Profile url.');
    return false;
  }
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
fmb.models.ProfileDeviceChecker = Backbone.Model.extend({
  sync: Backbone.ajaxSync
});


/**
 * @return {string}
 */
fmb.models.ProfileDeviceChecker.prototype.url = function() {
  var uuid = this.has('uuid') ? this.get('uuid') : '';
  return fmb.models.getApiUrl('/profile/device/' + uuid);
};


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
  fmb.models.sync.uuid = options.uuid;
  this.fetchFromStorage();

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
      fmb.log('Device onChange FIRST TIME - start service.');
      plugin.startService();
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
fmb.models.NotifyingCollection = fmb.Collection.extend({
  localStorage: new Backbone.LocalStorage('NotifyingCollection'),
  model: fmb.Model
});


/** @inheritDoc */
fmb.models.NotifyingCollection.prototype.initialize =
    function(models, options) {
  fmb.Collection.prototype.initialize.call(this);
  this.profile = options.profile;
};


/** @inheritDoc */
fmb.models.NotifyingCollection.prototype.url = function() {
  var username = this.profile.get('username');
  if (!username) {
    fmb.log('No username, no NotifyingCollection url.');
    return false;
  }
  return fmb.models.getApiUrl('/notifying/' + username);
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
    return fmb.models.getApiUrl('/notifying/') +
        this.profile.get('username');
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
    return fmb.models.getApiUrl('/notifying/delete/') +
        this.profile.get('username');
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
 * @param {string} username A username to follow.
 */
fmb.models.FollowingCollection.prototype.addByUsername = function(username) {
  fmb.log('addByUsername:', username);

  // Can't follow yerself or no one.
  if (username === '' ||
      username == this.profile.get('username')) {
    return;
  }

  var alreadyFollowing = this.find(function(model) {
    return model.get('profile')['username'] == username;
  });
  if (alreadyFollowing) {
    fmb.log('.. bail, already following', username);
    alert('You are already following ' + username);
    return;
  }

  var followModel = new fmb.models.AjaxSyncModel();
  followModel.url = _.bind(function() {
    return fmb.models.getApiUrl('/following/') +
        this.profile.get('username');
  }, this);
  followModel.save({'username': username}, {
    //url: url,  // why this no work?
    success: _.bind(function() {
      fmb.log('MONEY TRAIN, refetching goodies from server.');
      this.fetch();
    }, this),
    error: function(model, xhr, options) {
      if (xhr.status === 404) {
        alert('La bomba, seems we could not find a user ' + username);
      } else if (xhr.status === 409) {
        //alert('already following');
      }
    }
  });
};


/**
 * @param {string} username A username to follow.
 */
fmb.models.FollowingCollection.prototype.removeByUsername = function(username) {
  var followModel = new fmb.models.AjaxSyncModel();

  followModel.url = _.bind(function() {
    return fmb.models.getApiUrl('/following/delete/') +
        this.profile.get('username');
  }, this);

  followModel.save({
    'username': username
  }, {
    // Why does url not work here?
    //url: fmb.models.getApiUrl('/following/delete/') +
    //     this.profile.get('username'),
    success: _.bind(function() {
      fmb.log('MONEY TRAIN, refetching goodies from server.');
      this.fetch();
    }, this),
    error: function(model, xhr, options) {
      fmb.log('FAIL removing ' +  username + ', ' + xhr.status);
    }
  });
};


/**
 * @return {string}
 */
fmb.models.FollowingCollection.prototype.url = function() {
  var username = this.profile.get('username');
  if (!username) {
    fmb.log('No username, no FollowingCollection url.');
    return false;
  }
  return fmb.models.getApiUrl('/following/' + username);
};

