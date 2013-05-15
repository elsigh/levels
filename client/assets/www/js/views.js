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

  var extras = {};
  extras[WebIntent.EXTRA_TEXT] = fmb.models.SERVER + '/profile/' +
      this.model.user.get('key');
  extras[WebIntent.EXTRA_SUBJECT] = 'Follow my battery!';
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
        model: this.model.user,
        device: this.model.device
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
        user: this.model.user,
        device: this.model.device
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
  this.model.on('change:id', this.render, this);

  this.$account = $('<div class="account"></div>');
  this.$devices = $('<div class="devices"></div>');

  this.viewDevices_ = {};
  this.setUpDeviceViews_();
  this.model.get('devices').on('add change remove',
      this.setUpDeviceViews_, this);
};


/** @inheritDoc */
fmb.views.Account.prototype.render = function() {
  fmb.log('fmb.views.Account render');
  if (!this.rendered_) {
    this.rendered_ = true;
    this.$el.append(this.$account);
    this.$el.append(this.$devices);
  }

  var templateData = {
    'user': this.model.getTemplateData()
  };
  this.$account.html(fmb.views.getTemplateHtml('account', templateData));
  return this;
};


/**
 * @param {Event} e A change event.
 * @private
 */
fmb.views.Account.prototype.setUpDeviceViews_ = function(e) {
  fmb.log('fmb.views.Account setUpDeviceViews_',
          this.model.get('devices').length);
  this.model.get('devices').each(_.bind(function(device) {
    if (!this.viewDevices_[device.id]) {
      this.viewDevices_[device.id] = new fmb.views.Device({
        parent: this,
        model: device
      });
      this.viewDevices_[device.id].render();
      this.$devices.append(this.viewDevices_[device.id].$el);
    }
  }, this));
};


/**
 * @param {Event} e A change event.
 * @private
 */
fmb.views.Account.prototype.onChangeDeviceView_ = function(e) {
  //var deviceView = this.viewDevices_[device.id];
};


/**
 * @param {Event} e A click event.
 * @private
 */
fmb.views.Account.prototype.onClickLogin_ = function() {
  //document.location = fmb.models.SERVER + '/auth/google';
  fmb.log('fmb.views.Account onClickLogin_');

  this.model.loginToken_ = fmb.models.getUid();

  this.loginRef_ = window.open(
      fmb.models.SERVER + '/login?user_token=' +
          window.escape(this.model.loginToken_),
      '_blank',
      'location=no');

  // For Phonegap's InAppBrowser.
  this.loginRef_.addEventListener('loadstop',
      _.bind(this.onLoginRefLoadStop_, this),
      false);
  this.loginRef_.addEventListener('exit',
      _.bind(this.onLoginRefExit_, this),
      false);

  // For not-Phonegap.
  this.loginInterval_ = window.setInterval(_.bind(function() {
    if (this.loginRef_.closed) {
      this.onLoginRefExit_();
    }
  }, this), 500);
};


fmb.views.Account.prototype.onLoginRefLoadStop_ = function(e) {
  fmb.log('fmb.views.Account onLoginRefLoadStop_', e.url);
  if (e.url.indexOf('/profile') !== -1) {
    this.loginRef_.close();
    this.onLoginRefExit_();
  }
};


fmb.views.Account.prototype.onLoginRefExit_ = function(e) {
  fmb.log('fmb.views.Account onLoginRefExit_');
  window.clearInterval(this.loginInterval_);

  if (this.loginRef_.removeEventListener) {
    this.loginRef_.removeEventListener('loadstop',
        _.bind(this.onLoginRefLoadStop_, this));
    this.loginRef_.removeEventListener('exit',
        _.bind(this.onLoginRefExit_, this));
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
    'change [name="update_frequency"]': 'onChangeUpdateFrequency_'
  }
});


/** @inheritDoc */
fmb.views.Device.prototype.initialize = function(options) {
  this.$device = $('<div class="device"></div>');
  this.$graph = $('<div class="battery-chart">' +
    '<div class="y-axis"></div>' +
    '<div class="chart"></div>' + '</div>');
  this.viewNotifying = new fmb.views.Notifying({
    model: this.model.get('notifying'),
    device: this.model
  });
  this.model.on('change:settings', this.renderChart_, this);
};


/** @inheritDoc */
fmb.views.Device.prototype.render = function() {
  fmb.log('fmb.views.Device render', this.model.id);
  if (!this.rendered_) {
    this.rendered_ = true;
    this.$el.append(this.$device);
    this.$el.append(this.$graph);

    this.viewNotifying.render();
    this.$el.append(this.viewNotifying.$el);
  }
  var templateData = this.model.getTemplateData();
  this.$device.html(fmb.views.getTemplateHtml('device', templateData));
  return this;
};


/**
 * @private
 */
fmb.views.Device.prototype.renderChart_ = function() {
  fmb.log('fmb.views.Account renderChart_');
  if (!this.model.get('settings').length) {
    fmb.log('No setting data to render chart with.')
    return;
  }
  var dataSeries = [];
  this.model.get('settings').each(function(model, i) {
    dataSeries.push({
      x: i,
      y: model.get('battery_level')
    })
  });

  this.$graph.html('');  // reset

  var graph = new Rickshaw.Graph({
    element: this.$graph.get(0),
    renderer: 'area',
    height: this.$graph.height(),
    width: this.$graph.width(),
    series: [
      {
        data: dataSeries,
        color: 'steelblue'
      }
    ]
  });

  var yTicks = new Rickshaw.Graph.Axis.Y({
    graph: graph,
    orientation: 'left',
    tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
    element: this.$('.battery-chart .y-axis').get(0),
  });

  graph.render();
};

/**
 * @param {Event} e A change event.
 * @private
 */
fmb.views.Account.prototype.onChangeUpdateEnabled_ = function(e) {
  this.updateDevice_();
};


/**
 * @param {Event} e A change event.
 * @private
 */
fmb.views.Account.prototype.onChangeUpdateFrequency_ = function(e) {
  this.updateDevice_();
};


/**
 * @param {Event} e A submit event.
 * @private
 */
fmb.views.Account.prototype.onSubmitUpdateDevice_ = function(e) {
  e.preventDefault();
  this.updateDevice_();
};


/**
 * @private
 */
fmb.views.Account.prototype.updateDevice_ = function() {
  var $form = this.$('form.device-update');
  var data = fmb.views.serializeFormToObject($form);
  if (_.has(data, 'update_enabled')) {
    data['update_enabled'] = parseInt(data['update_enabled'], 10);
  }
  if (_.has(data, 'update_frequency')) {
    data['update_frequency'] = parseInt(data['update_frequency'], 10);
  }
  fmb.log('updateDevice_ w/', data);
  this.device.save(data);
};


/**
 * @private
 */
fmb.views.Account.prototype.debouncedUpdateDevice_ = _.debounce(function() {
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
    'tap .remove': 'onClickRemove_'
  }
});


/** @inheritDoc */
fmb.views.Notifying.prototype.initialize = function(options) {
  this.model.on('add change remove', this.render, this);
};


/** @inheritDoc */
fmb.views.Notifying.prototype.render = function() {
  var templateData = {
    'notifying': this.model.toJSON()
  };
  fmb.log('fmb.views.Notifying render w/',
          this.model.length, this.model.toJSON());
  this.$el.html(fmb.views.getTemplateHtml('notifying', templateData));
  return this;
};


/**
 * @param {Event} e A click event.
 * @private
 */
fmb.views.Notifying.prototype.onClickNotifyingAdd_ = function(e) {
  if (fmb.models.SERVER == fmb.models.SERVER_PROD) {
    var emailOrPhone = $(e.currentTarget).hasClass('notifying-add-phone') ?
        'phone' : 'email';
    fmb.log('onClickNotifyingAdd_ emailOrPhone', emailOrPhone);

    cordova.require('cordova/plugin/contactview').show(
        _.bind(function(contact) {
          fmb.log('GOT CONTACT!' + JSON.stringify(contact));
          //{"email":"elsigh@gmail.com","phone":"512-698-9983","name":"Lindsey Simon"}
          if (contact['phone']) {
            this.model.addContact({
              'name': contact['name'],
              'means': contact['phone'],
              'type': 'phone'
            });
          } else if (contact['email']) {
            this.model.addContact({
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
    this.model.addContact({
      'means': means,
      'name': 'Somebody',
      'type': 'phone'
    });
  }
};


/**
 * @param {Event} e A click event.
 * @private
 */
fmb.views.Notifying.prototype.onClickRemove_ = function(e) {
  var means = $(e.currentTarget).data('means');
  var isSure = window.confirm('Really remove ' + means + ' from the list?');
  if (!isSure) {
    return;
  }
  fmb.log('remove means', means);
  this.model.removeByMeans(means);
};


/******************************************************************************/



/**
 * @extends {Backbone.View}
 * @constructor
 */
fmb.views.Following = Backbone.View.extend({
  el: '.fmb-following',
  events: {
    'tap .following-user': 'onClickFollowingUser_',
    'tap .remove': 'onClickRemove_'
  }
});


/** @inheritDoc */
fmb.views.Following.prototype.initialize = function(options) {
  this.user = options.user;
  this.device = options.device;

  this.model.on('all', this.onAll_, this);
  this.device.on('battery_status', this.render, this);
  this.device.on('change', this.render, this);
};


/**
 * @param {Boolean} isActive True for active.
 */
fmb.views.Following.prototype.setIsActive = function(isActive) {
  this.model.stopFetchPoll();
  if (isActive) {
    fmb.log('Set following fetch interval.');
    this.model.startFetchPoll(30 * 1000);
  }
};


fmb.views.Following.prototype.onAll_ = function(event) {
  //fmb.log('onAll!', arguments)
  this.render();
};


/** @inheritDoc */
fmb.views.Following.prototype.render = _.debounce(function() {
  var thisPhoneTemplateData = {
    'user': this.user.getTemplateData(),
    'device': this.device.getTemplateData(),
    'settings': {
      'created_pretty': 'live!',
      'battery_level': window.navigator.battery && window.navigator.battery.level ||
          50,
      'is_charging': window.navigator.battery &&
          window.navigator.battery.isPlugged ? 1 : 0
    }
  };
  //fmb.log('Following render.', thisPhoneTemplateData);
  var templateData = {
    'following': this.model.toJSON(),
    'this_phone': thisPhoneTemplateData,
    'device': this.device.getTemplateData()
  };
  this.$el.html(fmb.views.getTemplateHtml('following', templateData));
  return this;
}, 500);


/**
 * @param {Event} e A click event.
 * @private
 */
fmb.views.Following.prototype.onClickFollowingUser_ = function(e) {
  return; // TODO(elsigh): Something fun like this.
  var extras = {};
  extras[WebIntent.EXTRA_TEXT] = fmb.models.SERVER + '/profile/' +
      this.model.user.get('key');
  extras[WebIntent.EXTRA_SUBJECT] = 'Dude, you need to charge your phone!';
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
 * @param {Event} e A click event.
 * @private
 */
fmb.views.Following.prototype.onClickRemove_ = function(e) {
  var userKey = $(e.currentTarget).data('key');
  var isSure = window.confirm('Really remove them from your list?');
  if (!isSure) {
    return;
  }
  fmb.log('fmb.views.Following onClickRemove_ userKey', userKey);
  this.model.removeByUserKey(userKey);
};



