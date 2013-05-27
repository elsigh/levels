


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
//fmb.models.SERVER_LOCAL = fmb.models.SERVER_PROD;

/**
 * @type {string}
 */
fmb.models.SERVER_SHARE = 'http://www.levelsapp.com';


/**
 * @type {string}
 */
fmb.models.SERVER = fmb.ua.IS_ANDROID && fmb.ua.IS_CORDOVA ?
    fmb.models.SERVER_PROD : fmb.models.SERVER_LOCAL;


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
 * @param {string|number} num A number.
 * @return {string|number} The number padded with a leading zero, if 1 char.
 */
fmb.models.padNum2Chars = function(num) {
  return num < 10 ? '0' + num : num;
};


/**
 * @param {number} time An ISO time.
 * @return {string} A date string ala 2013-05-20T15:40:40.290320.
 */
fmb.models.getISODate = function(opt_date) {
  var d = opt_date || new Date();
  return d.getUTCFullYear() + '-' +
      fmb.models.padNum2Chars(d.getUTCMonth() + 1) + '-' +
      fmb.models.padNum2Chars(d.getUTCDate()) + 'T' +
      fmb.models.padNum2Chars(d.getUTCHours()) + ':' +
      fmb.models.padNum2Chars(d.getUTCMinutes()) + ':' +
      fmb.models.padNum2Chars(d.getUTCSeconds()) + 'Z';
};


/**
 * @param {number} time An ISO time.
 */
fmb.models.prettyDate = function(time) {
  var date = new Date(time),
    diff = (((new Date()).getTime() - date.getTime()) / 1000),
    day_diff = Math.floor(diff / 86400);

  if ( isNaN(day_diff) || day_diff < 0 || day_diff >= 31 )
    return 'a bit ago';

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
  fmb.log('fmb.models.sync', method, model.id,
          'server_only?', options['server_only'],
          'local_storage_only', options['local_storage_only']);

  options = options ? _.clone(options) : {};

  // Saves to local storage first unless we explicitly don't want to.
  if (model.localStorage && !options['server_only']) {
    Backbone.LocalStorage.sync.apply(this, arguments);
  }

  if (options['local_storage_only']) {
    //fmb.log('fmb.models.sync w/ local storage only');
    return;
  }

  var url = options.url || model.url && model.url();
  if (!url) {
    fmb.log('No url, no fetchery.');
    return;
  }

  // Ensure JSON content-type.
  options.contentType = 'application/json; charset=utf8';

  // Includes our auth token in requests.
  if (fmb.models.sync.userKey) {
    if (method == 'update' || method == 'create' || method == 'delete') {
      var data = options.data ? options.data : model.toJSON();
      data['api_token'] = fmb.models.sync.apiToken;
      data['user_key'] = fmb.models.sync.userKey;

      //if (fmb.models.sync.deviceId) {
      //  data['device_id'] = fmb.models.sync.deviceId;
      //}
      options.data = JSON.stringify(data);

    // fetch = get
    } else {
      var data = options.data || {};
      _.extend(data, {
        'api_token': fmb.models.sync.apiToken,
        'user_key': fmb.models.sync.userKey
      });
      options.data = data;
    }
  }
  fmb.log('---------------> AJAX SYNC', method, url);
  Backbone.ajaxSync.call(this, method, model, options);
};

// Define sync =)
Backbone.sync = fmb.models.sync;


/**
 * @type {string}
 */
fmb.models.sync.apiToken = null;


/**
 * @type {string}
 */
fmb.models.sync.userKey = null;


/**
 * @type {string}
 */
fmb.models.sync.deviceId = null;


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
 * @extends {Backbone.Model}
 * @constructor
 */
fmb.Model = Backbone.Model.extend({
  idAttribute: 'key'
});


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
fmb.Model.prototype.set = function(key, value, options) {
  //fmb.log('fmb.Model set', this.id, 'is model:',
  //        this instanceof Backbone.Model);

  // Do nothing if trying to set a falsy key.
  if (typeof key === 'undefined' || key === null) {
    return this;
  }
  var attrs;
  // Handle both `"key", value` and `{key: value}` -style arguments.
  if (_.isObject(key)) {
    attrs = _.clone(key);
    options = value;
  } else {
    attrs = {};
    attrs[key] = value;
  }

  var data = attrs;

  // Injects "created_pretty" for the templates.
  if (data['created']) {
    data['created_pretty'] = fmb.models.prettyDate(
        new Date(data['created']).getTime());
  }

  if (this.submodels) {
    //fmb.log('Iterating through submodels', _.keys(this.submodels).length);
    _.each(this.submodels,
      _.bind(function(ctor, submodelName) {
        /*
        fmb.log('Looking for submodelName', submodelName,
                'in data yields:',
                (data[submodelName] &&
                 data[submodelName].length || 0),
                this.id,
                this.get(submodelName));
        */

        // wait:true can result in this case so we correct for it.
        if (data[submodelName] instanceof Backbone.Model ||
            data[submodelName] instanceof Backbone.Collection) {
          data[submodelName] = data[submodelName].toJSON();
        }

        if (!this.has(submodelName)) {
          //fmb.log('creating submodel for', submodelName)
          data[submodelName] = new ctor(data[submodelName], {
            parent: this
          });

        } else if (!_.isUndefined(data[submodelName])) {
          // Allow "null" to pass through.
          if (!_.isNull(data[submodelName])) {
            var submodel = this.get(submodelName);
            submodel.set(data[submodelName], options);
            delete data[submodelName];
          }
        }

      }, this));
  }

  //fmb.log('Calling Backbone.Model.set()');
  return Backbone.Model.prototype.set.call(this, data, options);
};


/** @inheritDoc */
fmb.Model.prototype.toJSON = function() {
  //fmb.log('fmb.Model toJSON');
  var json = Backbone.Model.prototype.toJSON.call(this);
  _.each(this.submodels,
      _.bind(function(constructor, submodelName) {
        if (json[submodelName]) {
          json[submodelName] = this.get(submodelName).toJSON()
        }
      }, this));
  return json;
};


/** @inheritDoc */
fmb.Model.prototype.parse = function(response, xhr) {
  //fmb.log('fmb.Model parse id', this.id);

  // Always store server data to localStorage.
  if (response['status'] === 0 && this.localStorage) {
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
  fmb.log('fmb.Model saveToServer id', this.id);
  var options = opt_options || {};
  options['server_only'] = true;
  this.save(opt_data, options);
};


/**
 * Note: Our modified copy of Backbone.localStorage assumes this
 * function's existence.
 * @return {Object} Overridable by subclasses.
 */
fmb.Model.prototype.getStorageData = function() {
  //fmb.log('fmb.Model getStorageData');
  var data = fmb.clone(this.toJSON());
  _.each(this.submodels,
      _.bind(function(constructor, submodelName) {
        var submodel = this.get(submodelName);
        if (submodel && submodel.getStorageData) {
          data[submodelName] = submodel.getStorageData();
        }
      }, this));
  return data;
};


/**
 * Save me - to storage..
 */
fmb.Model.prototype.saveToStorage = function(opt_data, opt_options) {
  fmb.log('fmb.Model saveToStorage id', this.id);
  var options = opt_options || {};
  options['local_storage_only'] = true;
  this.save(opt_data, options);
};


/**
 * @param {Object=} opt_options Options config.
 */
fmb.Model.prototype.fetchFromStorage = function(opt_options) {
  // Pretend to be async.
  _.defer(_.bind(function() {
    var results = this.localStorage.findAll();
    //fmb.log('fetchFromStorage RESULTS:', results);
    if (results.length) {
      this.set(results[results.length - 1], opt_options);
    }
  }, this));
};


/**
 * @type {number}
 * @private
 */
fmb.Model.prototype.fetchTimeout_ = null;


/**
 * Naive interval based polling fetch.
 * @param {number} timeout How often to fetch.
 */
fmb.Model.prototype.startFetchPoll = function(timeout) {
  this.stopFetchPoll();
  this.fetch();
  this.fetchTimeout_ = window.setInterval(
      _.bind(this.fetch, this),
      timeout);
};


/**
 * Clears the fetch timer.
 */
fmb.Model.prototype.stopFetchPoll = function() {
  if (this.fetchTimeout_ !== null) {
    //fmb.log('fmb.Model stopFetchPoll');
    window.clearInterval(this.fetchTimeout_);
    this.fetchTimeout_ = null;
  }
};


/******************************************************************************/



/**
 * @extends {Backbone.Model}
 * @constructor
 */
fmb.Collection = Backbone.Collection.extend({
  model: fmb.Model
});


/** @inheritDoc */
fmb.Collection.prototype.initialize = function(opt_models, opt_options) {
  //fmb.log('fmb.Collection initialize');

  var options = opt_options || {};
  if (options.parent) {
    this.parent = options.parent;
  }

  //fmb.Model.prototype.initializeSubmodels.apply(this, arguments);
  if (this.localStorage) {
    this.fetchFromStorage({silent: true});
    this.on('reset', function() {
      this.each(function(model) {
        model.saveToStorage();
      });
    }, this);
  }
};


/**
 * @param {Object=} opt_options An options config.
 */
fmb.Collection.prototype.fetchFromStorage = function(opt_options) {
  // Pretend to be async.
  if (this.localStorage) {
    //_.defer(_.bind(function() {
      var results = this.localStorage.findAll();
      fmb.log('fmb.Collection fetchFromStorage:', results.length);
      this.reset(results, opt_options);
    //}, this));
  }
};


/** @inheritDoc */
fmb.Collection.prototype.toJSON = function() {
  return this.map(function(model) {
    return model.toJSON();
  })
};


/** @inheritDoc */
fmb.Collection.prototype.getStorageData = function() {
  return this.map(function(model) {
    return model.getStorageData();
  });
};


/**
 * @type {number}
 * @private
 */
fmb.Collection.prototype.fetchTimeout_ = null;


/**
 * Naive interval based polling fetch.
 * @param {number} timeout How often to fetch.
 */
fmb.Collection.prototype.startFetchPoll = function(timeout) {
  fmb.Model.prototype.startFetchPoll.call(this, timeout);
};


/**
 * Clears the fetch timer.
 */
fmb.Collection.prototype.stopFetchPoll = function() {
  fmb.Model.prototype.stopFetchPoll.call(this);
};
