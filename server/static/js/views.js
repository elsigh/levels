


// Proxy click as zepto tap so we can bind to "tap"
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
 * @type {Object} Views namespace.
 */
fmb.views = {};

/**
 * @param {string} name The template name.
 * @param {Object=} opt_data The template data.
 * @param {Object=} opt_partials Template partials.
 * @return {string} The template as HTML.
 */
fmb.views.getTemplateHtml = function(name, opt_data, opt_partials) {
  var data = opt_data || {};
  _.extend(data, {
    'global_external_protocol': window.location.protocol == 'file:' ?
        'http' : window.location.protocol,
    'api_server': fmb.models.SERVER
  });
  var html = window['templates'][name].render(data, opt_partials);
  return html;
};


/**
 * A helper like benalman's jQuery serializeObject.
 * @param {Element|Zepto} form A form element reference.
 * @return {Object} A dictionary of name value pairs.
 */
fmb.views.serializeFormToObject = function(form) {
  var data = {};
  var $form = $(form);
  var arrayData = $form.serializeArray();
  _.each(arrayData, function(obj) {
    if (obj.name) {

      // Allows for inclusion of input values as objects, i.e:
      // <input data-form-obj="foo" name="bar" value="baz">
      // will result in data['foo']['bar'] = 'baz'.
      var objKey = $form.
          find('input[name="' + obj.name + '"]').
          data('form-obj');

      // Allows for the includes of input values as arrays, i.e:
      // <input data-form-array="foo" name="foo-0" value="baz">
      // <input data-form-array="foo" name="foo-1" value="bat">
      // will result in data['foo'] = ['baz', 'bat'].
      var arrayKey = $form.
          find('input[name="' + obj.name + '"]').
          data('form-array');

      if (objKey) {
        if (!data[objKey]) {
          data[objKey] = {};
        }
        data[objKey][obj.name] = obj.value;

      } else if (arrayKey) {
        if (!data[arrayKey]) {
          data[arrayKey] = [];
        }
        data[arrayKey].push(obj.value);

      } else {
        data[obj.name] = obj.value;
      }
    }
  });
  return data;
};


/******************************************************************************/



/**
 * @extends {Backbone.View}
 * @constructor
 */
fmb.views.App = Backbone.View.extend({
  el: '.fmb-app',
  events: {
    'tap .tabs a': 'onClickTab_',
    'tap .share': 'onClickShare_'
    //'tap .tabs a': 'onClickTab_'
  }
});


/** @inheritDoc */
fmb.views.App.prototype.initialize = function(options) {
  fmb.log('fmb.views.App.initialize', this.model);

};


/**
 * @param {Event} e A click event.
 * @private
 */
fmb.views.App.prototype.onClickShare_ = function(e) {
  fmb.log('fmb.views.App.onClickShare_', e);
  e.preventDefault();
  if (!this.model.user.get('api_token')) {
    fmb.log('Gotta get a api_token before sharing.');
    return;
  }
  this.$('.tabs .share').addClass('selected');
  _.delay(_.bind(function() {
    this.$('.tabs .share').removeClass('selected');
  }, this), 500);


  if (fmb.ua.IS_ANDROID && fmb.ua.IS_CORDOVA) {
    var extras = {};
    var text = 'Check out my Levels, and send me yours!';
    extras[WebIntent.EXTRA_TEXT] = text + ' ' + this.model.user.getProfileUrl();
    extras[WebIntent.EXTRA_SUBJECT] = text;
    window.plugins.webintent.startActivity({
        action: WebIntent.ACTION_SEND,
        type: 'text/plain',
        extras: extras
    }, function() {
        fmb.log('Share sent!');
    }, function () {
        fmb.log('Share fail!');
    });

  } else {
    var uniqueProfileStr = window.prompt('Enter a user unique str to follow:');
    this.model.user.get('following').addByUniqueProfileStr(uniqueProfileStr);
  }

};


/**
 * @param {Event} e A click event.
 * @private
 */
fmb.views.App.prototype.onClickTab_ = function(e) {
  fmb.log('fmb.views.App.onClickTab_', e);
  e.preventDefault();
  if (!this.model.user.get('api_token')) {
    fmb.log('Gotta get a api_token before navigating.');
    return;
  }
  window['app'].navigate($(e.currentTarget).attr('href'),
                         {trigger: true});
};


/**
 * @type {Backbone.View} view A view instance.
 */
fmb.views.App.prototype.setCurrentView = function(view) {

  if (this.currentView) {
    this.currentView.setIsActive &&
        this.currentView.setIsActive(false);
  }
  this.currentView = view;
  this.currentView.setIsActive &&
      this.currentView.setIsActive(true);
};


/**
 * @param {Object} route A route.
 */
fmb.views.App.prototype.transitionPage = function(route) {
  fmb.log('fmb.views.App --> transitionPage', route);

  var newTab;
  var newView;

  this.$('.tabs .selected').removeClass('selected');
  this.$('.fmb-tab.fmb-active').removeClass('fmb-active');

  if (_.isEqual(fmb.App.Routes.ACCOUNT, route)) {
    if (!this.viewAccount) {
      this.viewAccount = new fmb.views.Account({
        model: this.model.user
      });
      this.viewAccount.render();
    }
    newTab = 'account';
    newView = this.viewAccount;

    this.$('.tabs .account').addClass('selected');

  } else if (_.isEqual(fmb.App.Routes.FOLLOWING, route)) {
    if (!this.viewFollowing) {
      this.viewFollowing = new fmb.views.Following({
        model: this.model.user.get('following'),
        user: this.model.user
      });
      this.viewFollowing.render();
    }
    newTab = 'following';
    newView = this.viewFollowing;
  }
  this.$('.tabs .' + newTab).addClass('selected');
  this.$('.fmb-tab.fmb-tab-' + newTab).addClass('fmb-active');
  this.setCurrentView(newView);
};


/******************************************************************************/



/**
 * @extends {Backbone.View}
 * @constructor
 */
fmb.views.Account = Backbone.View.extend({
  el: '.fmb-account',
  events: {
    'tap .login-google': 'onClickLogin_',
    'change .device-view': 'onChangeDeviceView_'
  }
});


/** @inheritDoc */
fmb.views.Account.prototype.initialize = function(options) {
  fmb.log('views.Account initialize');
  this.model.on('change:key', this.render, this);

  this.$account = $('<div class="account"></div>');
  this.$devices = $('<div class="devices"></div>');

  this.subViews_ = {};
  this.onAddDevice_();
  this.listenTo(this.model.get('devices'), 'add', this.onAddDevice_);
  this.listenTo(this.model.get('devices'), 'remove', this.onRemoveDevice_);
};


/** @inheritDoc */
fmb.views.Account.prototype.render = function() {
  fmb.log('fmb.views.Account render');
  if (!this.rendered_) {
    this.rendered_ = true;
    this.$el.append(this.$account);
    this.$el.append(this.$devices);
  }

  this.$devices.toggle(this.model.get('id'));

  var templateData = {
    'user': this.model.getTemplateData()
  };
  this.$account.html(fmb.views.getTemplateHtml('account', templateData));
  return this;
};


/**
 * @param {Backbone.Model} e A device model.
 * @private
 */
fmb.views.Account.prototype.onAddDevice_ = function(model) {
  fmb.log('fmb.views.Account onAddDevice_',
          this.model.get('devices').length);
  this.model.get('devices').each(_.bind(function(model) {
    this.addDeviceView_(model);
  }, this));
};


/**
 * @param {Backbone.Model} e A device model.
 * @private
 */
fmb.views.Account.prototype.addDeviceView_ = function(model) {
  if (!this.subViews_[model.cid]) {
    this.subViews_[model.cid] = new fmb.views.Device({
      parent: this,
      model: model
    });
    this.subViews_[model.cid].render();
    // Make the user device the first one the list.
    if (model === this.model.device) {
      this.$devices.prepend(this.subViews_[model.cid].$el);
    } else {
      this.$devices.append(this.subViews_[model.cid].$el);
    }
  }
}

/**
 * @param {Backbone.Model} e A backbone model.
 * @private
 */
fmb.views.Account.prototype.onRemoveDevice_ = function(model) {
  this.subViews_[model.cid] && this.subViews_[model.cid].remove();
  this.subViews_[model.cid] = null;
};


/**
 * Wire up a SELECT to change the visible device one day.
 * @param {Event} e A change event.
 * @private
 */
fmb.views.Account.prototype.onChangeDeviceView_ = function(e) {
  //var deviceView = this.subViews_[device.id];
};


/**
 * @param {Event} e A click event.
 * @private
 */
fmb.views.Account.prototype.onClickLogin_ = function() {
  fmb.log('fmb.views.Account onClickLogin_');

  this.model.loginToken_ = fmb.models.getUid();

  this.inAppBrowser_ = window.open(
      fmb.models.SERVER_SHARE + '/login?user_token=' +
          window.escape(this.model.loginToken_),
      '_blank',
      'location=yes');

  // For Phonegap's InAppBrowser.
  if (this.inAppBrowser_.addEventListener) {
    this.inAppBrowser_.addEventListener('loadstart',
        _.bind(this.onInAppBrowserLoadStart_, this),
        false);
    this.inAppBrowser_.addEventListener('loadstop',
        _.bind(this.onInAppBrowserLoadStop_, this),
        false);
    this.inAppBrowser_.addEventListener('exit',
        _.bind(this.onInAppBrowserExit_, this),
        false);
  }

  // For not-Phonegap.
  this.inAppBrowserCloseCheckInterval_ = window.setInterval(_.bind(function() {
    if (this.inAppBrowser_.closed) {
      this.onInAppBrowserExit_();
    }
  }, this), 500);
};


/**
 * @param {Event} e An event.
 * @private
 */
fmb.views.Account.prototype.onInAppBrowserLoadStart_ = function(e) {
  fmb.log('fmb.views.Account onInAppBrowserLoadStart_', e.url);
  navigator.notification &&
      navigator.notification.activityStart('', 'Loading ...');
};


/**
 * @param {Event} e An event.
 * @private
 */
fmb.views.Account.prototype.onInAppBrowserLoadStop_ = function(e) {
  fmb.log('fmb.views.Account onInAppBrowserLoadStop_', e.url);

  navigator.notification && navigator.notification.activityStop();

  if (e.url.indexOf('/profile') !== -1) {
    this.inAppBrowser_.close();
    this.onInAppBrowserExit_();
  }
};


fmb.views.Account.prototype.onInAppBrowserExit_ = function(e) {
  fmb.log('fmb.views.Account onInAppBrowserExit_');

  navigator.notification && navigator.notification.activityStop();

  window.clearInterval(this.inAppBrowserCloseCheckInterval_);

  if (this.inAppBrowser_.removeEventListener) {
    this.inAppBrowser_.removeEventListener('loadstop',
        _.bind(this.onInAppBrowserLoadStop_, this));
    this.inAppBrowser_.removeEventListener('exit',
        _.bind(this.onInAppBrowserExit_, this));
  }

  if (this.model.loginToken_) {
    this.model.syncByToken(this.model.loginToken_);
    this.model.loginToken_ = null;
  }
};


/******************************************************************************/



/**
 * @extends {Backbone.View}
 * @constructor
 */
fmb.views.Device = Backbone.View.extend({
  className: 'fmb-device',
  events: {
    'submit form.device-update': 'onSubmitUpdateDevice_',
    'tap input[type="radio"]': 'onChangeUpdateEnabled_',
    'tap .device-remove': 'onClickRemove_',
    'change [name="update_frequency"]': 'onChangeUpdateFrequency_'
  }
});


/** @inheritDoc */
fmb.views.Device.prototype.initialize = function(options) {
  this.$device = $('<div class="device"></div>');
  this.viewNotifying = new fmb.views.Notifying({
    model: this.model.get('notifying'),
    device: this.model
  });
};


/** @inheritDoc */
fmb.views.Device.prototype.render = function() {
  fmb.log('fmb.views.Device render', this.model.id);
  if (!this.rendered_) {
    this.rendered_ = true;
    this.$el.append(this.$device);

    this.viewNotifying.render();
    this.$el.append(this.viewNotifying.$el);
  }
  var templateData = this.model.getTemplateData();
  this.$device.html(fmb.views.getTemplateHtml('device', templateData));
  return this;
};


/**
 * @param {Event} e A change event.
 * @private
 */
fmb.views.Device.prototype.onClickRemove_ = function(e) {
  var isSure = window.confirm(
      'Really remove this device? - this is not revertable.');
  if (!isSure) {
    return;
  }
  this.model.collection.remove(this.model.id);
};


/**
 * @param {Event} e A change event.
 * @private
 */
fmb.views.Device.prototype.onChangeUpdateEnabled_ = function(e) {
  this.updateDevice_();
};


/**
 * @param {Event} e A change event.
 * @private
 */
fmb.views.Device.prototype.onChangeUpdateFrequency_ = function(e) {
  this.updateDevice_();
};


/**
 * @param {Event} e A submit event.
 * @private
 */
fmb.views.Device.prototype.onSubmitUpdateDevice_ = function(e) {
  e.preventDefault();
  this.updateDevice_();
};


/**
 * @private
 */
fmb.views.Device.prototype.updateDevice_ = function() {
  var $form = this.$('form.device-update');
  var data = fmb.views.serializeFormToObject($form);
  if (_.has(data, 'update_enabled')) {
    data['update_enabled'] = parseInt(data['update_enabled'], 10);
  }
  if (_.has(data, 'update_frequency')) {
    data['update_frequency'] = parseInt(data['update_frequency'], 10);
  }
  fmb.log('updateDevice_ w/', data);
  this.model.device.save(data);
};


/**
 * @private
 */
fmb.views.Device.prototype.debouncedUpdateDevice_ = _.debounce(function() {
  this.updateDevice_();
}, 500);


/******************************************************************************/



/**
 * @extends {Backbone.View}
 * @constructor
 */
fmb.views.Notifying = Backbone.View.extend({
  className: 'fmb-notifying',
  events: {
    'tap .notifying-add-phone': 'onClickNotifyingAdd_',
    'tap .notifying-add-email': 'onClickNotifyingAdd_',
    'tap .notifying-remove': 'onClickRemove_'
  }
});


/** @inheritDoc */
fmb.views.Notifying.prototype.initialize = function(options) {
  this.listenTo(this.model, 'add change remove', this.render);
};


/** @inheritDoc */
fmb.views.Notifying.prototype.render = function() {
  var templateData = {
    'notifying': this.model.toJSON()
  };

  // We always notify you via email.
  templateData['notifying'].unshift({
    'name': app.model.user.get('name'),
    'means': app.model.user.get('email'),
    'type': 'email',
    'is_user_email': true
  });

  fmb.log('fmb.views.Notifying render w/', this.model.length);
  this.$el.html(fmb.views.getTemplateHtml('notifying', templateData));
  return this;
};


/**
 * @param {Event} e A click event.
 * @private
 */
fmb.views.Notifying.prototype.onClickNotifyingAdd_ = function(e) {
  if (fmb.ua.IS_ANDROID && fmb.ua.IS_CORDOVA) {
    var emailOrPhone = $(e.currentTarget).hasClass('notifying-add-phone') ?
        'phone' : 'email';
    fmb.log('onClickNotifyingAdd_ emailOrPhone', emailOrPhone);

    cordova.require('cordova/plugin/contactview').show(
        _.bind(function(contact) {
          fmb.log('GOT CONTACT!' + JSON.stringify(contact));

          if (contact['phone']) {
            this.model.add({
              'name': contact['name'],
              'means': contact['phone'],
              'type': 'phone'
            });

          } else if (contact['email']) {
            this.model.add({
              'name': contact['name'],
              'means': contact['email'],
              'type': 'email'
            });

          } else {
            alert('Unable to get a means of contact for that record. =(');
          }
        }, this),
        function(fail) {
          fmb.log('FAIL CONTACT', fail);
          alert('We were unable to get the contact you selected. =(');
        },
        emailOrPhone);

  } else {
    var means = window.prompt('Means of contact:');
    if (!means) {
      return;
    }
    this.model.add({
      'means': means,
      'name': 'Somebody',
      'type': means.match('@') ? 'email' : 'phone'
    });
  }
};


/**
 * @param {Event} e A click event.
 * @private
 */
fmb.views.Notifying.prototype.onClickRemove_ = function(e) {
  var isSure = window.confirm('Really remove ' +
      $(e.currentTarget).data('means') +
      ' from your notification list?');
  if (!isSure) {
    return;
  }
  var key = $(e.currentTarget).data('key');
  this.model.remove(key);
};


/******************************************************************************/



/**
 * @extends {Backbone.View}
 * @constructor
 */
fmb.views.Following = Backbone.View.extend({
  el: '.fmb-following',
  events: {

  }
});


/** @inheritDoc */
fmb.views.Following.prototype.initialize = function(options) {
  this.user = options.user;
  this.subViews_ = {};
  this.listenTo(this.model, 'add', this.render);
  this.listenTo(this.model, 'remove', this.onRemove_);
};


/**
 * @param {Boolean} isActive True for active.
 */
fmb.views.Following.prototype.setIsActive = function(isActive) {
  this.model.stopFetchPoll();
  this.user.stopFetchPoll();
  if (isActive) {
    //fmb.log('Set following fetch interval.');
    this.model.startFetchPoll(60 * 1000);
    this.user.startFetchPoll(60 * 1000);
  }
};


/**
 * @param {Backbone.Model}
 * @private
 */
fmb.views.Following.prototype.onRemove_ = function(model) {
  fmb.log('fmb.views.Following onRemove_', model.id);
  if (!this.subViews_[model.cid]) {
    return;
  }
  this.subViews_[model.cid].remove();
  delete this.subViews_[model.cid];
};


/** @inheritDoc */
fmb.views.Following.prototype.render = function() {
  fmb.log('fmb.views.Following render');
  if (!this.rendered_) {
    this.rendered_ = true;
    this.$el.html(fmb.views.getTemplateHtml('following', {}));
    this.$table = this.$('table');

    // Add yo-self into the view.
    this.addSubview_(this.user);
  }

  this.model.each(_.bind(function(model) {
    this.addSubview_(model);
  }, this));
  return this;
};


fmb.views.Following.prototype.addSubview_ = function(model) {
  fmb.log('fmb.views.Following addSubview_', model.id);
  // Don't make views for models without ids.
  if (!this.subViews_[model.cid]) {
    this.subViews_[model.cid] = new fmb.views.FollowingUser({
      parent: this,
      model: model
    });
    this.subViews_[model.cid].render();
    this.$table.append(this.subViews_[model.cid].$el);
  }
};


/******************************************************************************/



/**
 * @extends {Backbone.View}
 * @constructor
 */
fmb.views.FollowingUser = Backbone.View.extend({
  className: 'fmb-following-user',
  tagName: 'tbody',
  events: {
    //'tap .user-name': 'onClickFollowingUser_',
    'tap .following-user-remove': 'onClickRemove_'
  }
});


/** @inheritDoc */
fmb.views.FollowingUser.prototype.initialize = function(options) {
  this.parent = options.parent;
  this.listenTo(this.model, 'change', _.debounce(this.render, this));
  this.listenTo(this.model.get('devices'), 'add', _.debounce(this.render));
  this.listenTo(this.model.get('devices'), 'remove', this.onRemoveDevice_);
  this.subViews_ = {};
};


/**
 * @param {Event} e A click event.
 * @private
 */
fmb.views.FollowingUser.prototype.onClickFollowingUser_ = function(e) {
  return; // TODO(elsigh): Something fun like this.
  var extras = {};
  extras[WebIntent.EXTRA_TEXT] = this.model.user.getProfileUrl();
  extras[WebIntent.EXTRA_SUBJECT] = 'Dude, charge your battery!';
  window.plugins.webintent.startActivity({
    action: WebIntent.ACTION_SEND,
    type: 'text/plain',
    extras: extras
  }, function() {
      fmb.log('Share sent!');
  }, function () {
      fmb.log('Share fail!');
  });
};


/**
 * @param {Backbone.Model}
 * @private
 */
fmb.views.FollowingUser.prototype.onRemoveDevice_ = function(model) {
  this.subViews_[model.cid].remove();
  delete this.subViews_[model.cid];
};


/**
 * @param {Event} e A click event.
 * @private
 */
fmb.views.FollowingUser.prototype.onClickRemove_ = function(e) {
  var isSure = window.confirm('Really remove ' + this.model.get('name') + '?');
  if (!isSure) {
    return;
  }
  fmb.log('fmb.views.FollowingUser onClickRemove_', this.model.id);
  this.model.collection.remove(this.model.id);
};


/** @inheritDoc */
fmb.views.FollowingUser.prototype.render = function() {
  fmb.log('fmb.views.FollowingUser render',
          this.model.id, this.model.get('name'));

  this.$el.data('key', this.model.key);
  var templateData = this.model.toJSON();
  if (app.model.user.id == this.model.id) {
    templateData['is_current_user'] = true;
  }

  this.$userRow && this.$userRow.remove();
  this.$userRow =
      $(fmb.views.getTemplateHtml('following_user', templateData));
  this.$el.prepend(this.$userRow);

  this.model.get('devices').each(_.bind(function(model) {
    if (!this.subViews_[model.cid]) {
      this.subViews_[model.cid] = new fmb.views.FollowingDevice({
        parent: this,
        model: model
      });
      this.subViews_[model.cid].render();
      this.$el.append(this.subViews_[model.cid].$el);
    }
  }, this));

  return this;
};


/** @inheritDoc */
fmb.views.FollowingUser.prototype.remove = function() {
  _.each(this.subViews_, _.bind(function(view, cid) {
    view && view.remove();
    delete this.subViews_[cid];
  }, this));
  Backbone.View.prototype.remove.apply(this, arguments);
};



/******************************************************************************/



/**
 * @extends {Backbone.View}
 * @constructor
 */
fmb.views.FollowingDevice = Backbone.View.extend({
  className: 'fmb-following-device',
  tagName: 'tr',
  events: {
  }
});


/** @inheritDoc */
fmb.views.FollowingDevice.prototype.initialize = function(options) {
  fmb.log('fmb.views.FollowingDevice initialize', this.model.id);
  this.parent = options.parent;
  this.listenTo(this.model, 'change', _.debounce(this.render, this));
  this.listenTo(this.model.get('settings'), 'add change remove',
                _.debounce(this.render, this));
};

/** @inheritDoc */
fmb.views.FollowingDevice.prototype.render = function() {
  fmb.log('fmb.views.FollowingDevice render', this.model.id);
  var templateData = this.model.toJSON();
  if (app.model.user.device.id == this.model.id) {
    templateData['is_current_user_device'] = true;
  }
  this.$el.data('key', this.model.id);
  this.$el.html(fmb.views.getTemplateHtml('following_device', templateData));

  // Need the figure element to actually be in the DOM for xCharts to work.
  _.defer(_.bind(function() {
    this.renderGraph_();
  }, this));

  return this;
};


/**
 * @private
 */
fmb.views.FollowingDevice.prototype.renderGraph_ = function() {
  fmb.log('fmb.views.FollowingDevice renderGraph_', this.model.id);
  if (!this.model.get('settings').length) {
    fmb.log('No setting data to render chart with.')
    return this;
  }

  var dataSeries = [];
  this.model.get('settings').each(function(model, i) {
    var xDate = new Date(model.get('created'));
    dataSeries.push({
      'x': xDate.getTime(),
      'x_readable': model.get('created_pretty'),
      'y': model.get('battery_level')
    });
  });

  fmb.log('fmb.views.FollowingDevice dataSeries', dataSeries);

  var data = {
    'xScale': 'time',
    'yScale': 'linear',
    'yMin': 0,
    'yMax': 100,
    'type': 'line',
    'main': [
      {
        'className': '.battery-graph-data-' + this.model.id,
        'data': dataSeries
      }
    ]
  };

  var opts = {
    'dataFormatX': function (x) { return new Date(x); },
    'tickFormatX': function (x) { return d3.time.format('%a %I%p')(x); },
    'axisPaddingTop': 10,
    'axisPaddingBottom': 0,
    'axisPaddingLeft': 0,
    'tickHintX': 4,
    'tickHintY': 2,
    'interpolation': 'basis',
    'yMin': 0
  };

  var chart = new xChart('line', data, '.battery-graph-' + this.model.id, opts);
};

