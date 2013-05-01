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
  if (!this.model.profile.get('username')) {
    fmb.log('Gotta get a username before sharing.');
    return;
  }
  this.$('.tabs .share').addClass('selected');
  _.delay(_.bind(function() {
    this.$('.tabs .share').removeClass('selected');
  }, this), 500);

  var extras = {};
  extras[WebIntent.EXTRA_TEXT] = fmb.models.SERVER + '/' +
      this.model.profile.get('username');
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
  if (!this.model.profile.get('username')) {
    fmb.log('Gotta get a username before navigating.');
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
    this.currentView.$el.removeClass('fmb-active');
    this.currentView.setIsActive &&
        this.currentView.setIsActive(false);
  }
  this.currentView = view;
  this.currentView.render();
  this.currentView.$el.addClass('fmb-active');
  this.currentView.setIsActive &&
      this.currentView.setIsActive(true);
};


/**
 * @param {Object} route A route.
 */
fmb.views.App.prototype.transitionPage = function(route) {
  fmb.log('fmb.views.App --> transitionPage', route);

  var newView;

  this.$('.tabs .selected').removeClass('selected');

  if (_.isEqual(fmb.App.Routes.ACCOUNT, route)) {
    if (!this.viewAccount) {
      this.viewAccount = new fmb.views.Account({
        model: this.model.profile,
        device: this.model.device
      });
    }
    newView = this.viewAccount;
    this.$('.tabs .account').addClass('selected');

  } else if (_.isEqual(fmb.App.Routes.FOLLOWING, route)) {
    if (!this.viewFollowing) {
      this.viewFollowing = new fmb.views.Following({
        profile: this.model.profile,
        device: this.model.device,
        model: this.model.following
      });
    }
    newView = this.viewFollowing;
    this.$('.tabs .following').addClass('selected');

  } else if (_.isEqual(fmb.App.Routes.NOTIFYING, route)) {
    if (!this.viewNotifying) {
      this.viewNotifying = new fmb.views.Notifying({
        profile: this.model.profile,
        device: this.model.device,
        model: this.model.notifying
      });
    }
    newView = this.viewNotifying;
    this.$('.tabs .notifying').addClass('selected');
  }

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
    'tap form.profile-create input[type="submit"]': 'onSubmitCreateProfile_',
    'tap .gplus-login': '',
    'submit form.profile-create': 'onSubmitCreateProfile_',
    'submit form.device-update': 'onSubmitUpdateDevice_',
    'tap input[type="radio"]': 'onChangeUpdateEnabled_',
    'change [name="update_frequency"]': 'onChangeUpdateFrequency_'
  }
});


/** @inheritDoc */
fmb.views.Account.prototype.initialize = function(options) {
  fmb.log('views.Account initialize');
  this.device = options.device;
  this.model.on('change', this.render, this);
  this.device.on('change', this.render, this);
};


/** @inheritDoc */
fmb.views.Account.prototype.render = function() {
  fmb.log('views.Account render');
  var templateData = {
    'profile': this.model.getTemplateData(),
    'device': this.device.getTemplateData()
  };
  this.$el.html(fmb.views.getTemplateHtml('account', templateData));

  this.$('select').val(this.device.get('update_frequency'));

  return this;
};


/**
 * @param {Event} e A submit event.
 * @private
 */
fmb.views.Account.prototype.onSubmitCreateProfile_ = function(e) {
  fmb.log('onSubmitCreateProfile_');
  e.preventDefault();
  var $form = this.$('form.profile-create');
  var data = fmb.views.serializeFormToObject($form);

  // First we need to check if this username is available.
  var username = data['username'];

  if (username.length < 3) {
    this.$('.username-taken').text(username);
    this.$('.username-taken-err').addClass('fmb-active');
    this.$('input[name="username"]').val('').focus();
    return;
  }

  var usernameChecker = new fmb.models.ProfileNameChecker({
    username: username,
    uuid: this.device.get('uuid')
  });

  this.$('.username-taken-err').removeClass('fmb-active');
  usernameChecker.fetch({
    success: _.bind(function(model, response, options) {
      // If we got a success callback, then this username is already
      // taken and found on our server.
      this.$('.username-taken').text(username);
      this.$('.username-taken-err').addClass('fmb-active');
      this.$('input[name="username"]').val('').focus();
    }, this),

    error: _.bind(function(model, xhr, options) {
      // All bueno, we can proceed to create the profile.
      if (xhr.status === 404) {
        this.model.save(data, {
          success: _.bind(function(model, response) {
            fmb.log('profile response::', response);
            // And save the device record to the server once the profile's
            // done, aka after api_token comes back from the server.
            if (response && response['api_token']) {
              _.delay(_.bind(this.device.saveToServer, this.device), 500);
            }
          }, this)
        });
      } else {
        alert('Yikes, you might be offline. Or else our server is ;/');
      }
    }, this)

  });
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
  el: '.fmb-notifying',
  events: {
    'tap .notifying-add-phone': 'onClickNotifyingAdd_',
    'tap .notifying-add-email': 'onClickNotifyingAdd_',
    'tap .remove': 'onClickRemove_',
    'change [name="notify_level"]': 'onChangeUpdateFrequency_'
  }
});


/** @inheritDoc */
fmb.views.Notifying.prototype.initialize = function(options) {
  this.profile = options.profile;
  this.device = options.device;
  this.model.on('all', this.render, this);
};


/** @inheritDoc */
fmb.views.Notifying.prototype.render = _.debounce(function() {
  fmb.log('Notifying render.');
  var templateData = {
    'notifying': this.model.toJSON(),
    'profile': this.profile.getTemplateData(),
    'device': this.device.getTemplateData()
  };
  this.$el.html(fmb.views.getTemplateHtml('notifying', templateData));

  this.$('select').val(this.device.get('notify_level'));

  return this;
}, 100);


/**
 * @param {Event} e A change event.
 * @private
 */
fmb.views.Notifying.prototype.onChangeUpdateFrequency_ = function(e) {
  fmb.views.Account.prototype.updateDevice_.call(this);
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
    'tap .follow-add-phone': 'onClickFollowAdd_',
    'tap .following-username': 'onClickFollowingUsername_',
    'tap .remove': 'onClickRemove_'
  }
});


/** @inheritDoc */
fmb.views.Following.prototype.initialize = function(options) {
  this.profile = options.profile;
  this.device = options.device;
  this.model.on('all', this.onAll_, this);
  this.device.on('battery_status', this.render, this);
  this.device.on('change', this.render, this);
};


/**
 * @type {number}
 * @private
 */
fmb.views.Following.prototype.followingTimeout_ = null;


/**
 * @param {Boolean} isActive True for active.
 */
fmb.views.Following.prototype.setIsActive = function(isActive) {
  if (this.followingTimeout_ !== null) {
    fmb.log('Clear following fetch interval.');
    window.clearInterval(this.followingTimeout_);
    this.followingTimeout_ = null;
  }
  if (isActive) {
    fmb.log('Set following fetch interval.');
    this.followingTimeout_ = window.setInterval(
        _.bind(this.model.fetch, this.model),
        30000);
  }
};


fmb.views.Following.prototype.onAll_ = function(event) {
  //fmb.log('onAll!', arguments)
  this.render();
};


/** @inheritDoc */
fmb.views.Following.prototype.render = _.debounce(function() {
  var thisPhoneTemplateData = {
    'profile': this.profile.getTemplateData(),
    'device': this.device.getTemplateData(),
    'settings': {
      'created_pretty': 'live!',
      'battery_level': window.navigator.battery && window.navigator.battery.level ||
          50,
      'is_charging': window.navigator.battery &&
          window.navigator.battery.isPlugged ? 1 : 0
    }
  };
  fmb.log('Following render.', thisPhoneTemplateData);
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
fmb.views.Following.prototype.onClickFollowingUsername_ = function(e) {
  var extras = {};
  extras[WebIntent.EXTRA_TEXT] = fmb.models.SERVER + '/' +
      this.model.profile.get('username');
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
fmb.views.Following.prototype.onClickFollowAdd_ = function(e) {
  var username = window.prompt('Type in the username to follow.');
  username && this.model.addByUsername(username);
};



/**
 * @param {Event} e A click event.
 * @private
 */
fmb.views.Following.prototype.onClickRemove_ = function(e) {
  var username = $(e.currentTarget).data('username');
  var isSure = window.confirm('Really remove ' + username + ' from your list?');
  if (!isSure) {
    return;
  }
  fmb.log('remove username', username);
  this.model.removeByUsername(username);
};



