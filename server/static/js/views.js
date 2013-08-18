
$.ajaxSettings['xhrCount'] = 0;

// Yep, we need zepto to work with CORS and cookies.
$.ajaxSettings['beforeSend'] = function(xhr, settings) {
  xhr.withCredentials = true;
  $.ajaxSettings['xhrCount']++;
  $('.fmb-app > .fmb-loading').show();
};

$.ajaxSettings['complete'] = function(xhr, status) {
  $.ajaxSettings['xhrCount']--;
  if ($.ajaxSettings['xhrCount'] === 0) {
    $('.fmb-app > .fmb-loading').hide();
  }
};

/*
$.ajaxSettings['success'] = function(xhr, status) {
  // noop
};
$.ajaxSettings['error'] = function(xhr, status) {
  // noop
};
*/

// Proxy click as zepto tap so we can bind to "tap"
$(document).ready(function(e) {
  var shouldPreventDefault = function(el) {
    var tagName = el.tagName.toLowerCase();
    switch (tagName) {
      case 'input':
      case 'select':
      case 'textarea':
      case 'label':
        return false;
        break;
      default:
        return true;
    }
  };
  // only do this if not on a touch device
  if (!('ontouchend' in window)) {
    $(document.body).on('click', function(e) {
      if (shouldPreventDefault(e.target)) {
        e.preventDefault();
        $(e.target).trigger('tap', e);
      }
    });

  // Nuke ghost clicks on touch devices.
  } else {
    $(document.body).on('click', function(e) {
      if (shouldPreventDefault(e.target)) {
        e.preventDefault();
      }
    });
  }
});


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
    'api_server': fmb.models.SERVER,
    'is_android': fmb.ua.IS_ANDROID,
    'is_ios': fmb.ua.IS_IOS
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


/**
 * @param {string} msg The message to show.
 */
fmb.views.showSpinner = function(msg) {
  navigator.notification && navigator.notification.activityStart &&
      navigator.notification.activityStart('', msg);
};


/**
 * Hide that notification.
 */
fmb.views.hideSpinner = function() {
  navigator.notification && navigator.notification.activityStop &&
      navigator.notification.activityStop();
};


/**
 * @param {string} msg The message to show.
 */
fmb.views.showMessage = function(msg) {
  //if (fmb.ua.IS_APP && fmb.ua.IS_ANDROID) {
  //  var plugin = cordova.require('cordova/plugin/levels');
  //  plugin && plugin.showMessage(msg);
  //} else {
  fmb.views.clearHideMessageTimeout_();
  $('.fmb-msg').text(msg);
  $('.fmb-msg-c').css('opacity', '0').show().animate({
    opacity: 1
  }, 250, 'linear', fmb.views.hideMessage_);
  //}
};


/**
 * @private {number}
 */
fmb.views.hideMessageTimeout_ = null;


/**
 * @private
 */
fmb.views.clearHideMessageTimeout_ = function() {
  if (fmb.views.hideMessageTimeout_ !== null) {
    window.clearTimeout(fmb.views.hideMessageTimeout_);
    fmb.views.hideMessageTimeout_ = null;
  }
};


/**
 * @private
 */
fmb.views.hideMessage_ = function() {
  fmb.views.clearHideMessageTimeout_();
  fmb.views.hideMessageTimeout_ = _.delay(function() {
    $('.fmb-msg-c').animate({
      opacity: 0
    }, 1000, 'linear', function() { $('.fmb-msg-c').hide(); });
  }, 2000);
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
    'tap .share': 'onClickShare_',
    'tap .fmb-app-link': 'onClickAppLink_'
    //'tap .tabs a': 'onClickTab_'
  }
});


/** @inheritDoc */
fmb.views.App.prototype.initialize = function(options) {
  fmb.log('fmb.views.App.initialize', this.model);
  $('body').addClass('fmb-platform-' + fmb.ua.getPlatform());

  this.listenTo(this.model.user, 'change:key', this.setUserSignedInClass_);
  this.setUserSignedInClass_();
};


/**
 * @param {Event} e A click event.
 * @private
 */
fmb.views.App.prototype.onClickAppLink_ = function(e) {
  fmb.log('fmb.views.App.onClickAppLink_', e);
  e.preventDefault();
  window['app'].navigate($(e.currentTarget).attr('href'),
                         {trigger: true});
};


/**
 * @private
 */
fmb.views.App.prototype.setUserSignedInClass_ = function() {
  $('body').toggleClass('fmb-signed-in', !!this.model.user.id);
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


  if (fmb.ua.IS_APP) {
    var subject = 'Check out my Levels!';
    var body = 'Check out my Levels, and send me yours!' +
        ' ' + this.model.user.getProfileUrl();
    var plugin = cordova.require('cordova/plugin/levels');
    plugin && plugin.shareApp(subject, body,
        function() {
          fmb.log('Share sent!');
        },
        function() {
          fmb.log('Share fail!');
        });

  } else {
    fmb.log('What should we do on the web in this case?');
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
 * @param {Backbone.View} view A view instance.
 * @param {number} i The index.
 */
fmb.views.App.prototype.setCurrentView = function(view, i) {
  if (this.currentView) {
    this.currentView.setIsActive &&
        this.currentView.setIsActive(false);
  }
  this.currentView = view;
  this.currentView.setIsActive &&
      this.currentView.setIsActive(true);

  /* One day, when mf webview on Android supports
     overflow-x:hidden + overflow-y:auto
  */
  var screenW = document.documentElement.clientWidth;

  if (!this.setTabLeft_) {
    var $fmbTabs = $('.fmb-tab');
    $('.fmb-tab-frame').css('width', $fmbTabs.length * screenW + 'px');

    $fmbTabs.each(function(i, el) {
      console.log('i,el', i, el);
      $(el).css('left', i * screenW + 'px');
    });
    this.setTabLeft_ = true;
  }

  var transform = 'translateX(-' + (i * screenW) + 'px)';
  $('.fmb-tab-frame').
      css('-webkit-transform', transform).
      css('transform', transform);

  _.defer(function() {
    // Enables transitions on all but the first change.
    if (!$('.fmb-tab-frame').hasClass('fmb-active')) {
      $('.fmb-tab-frame').addClass('fmb-active');
    }
  });
};


/**
 * @param {Object} route A route.
 */
fmb.views.App.prototype.transitionPage = function(route) {
  fmb.log('fmb.views.App --> transitionPage', route);

  var newTab;
  var newView;

  this.$('.tabs .selected').removeClass('selected');
  var $priorActiveTab = this.$('.fmb-tab.fmb-active');
  if ($priorActiveTab.length) {
    $priorActiveTab.removeClass('fmb-active');
    _.defer(function() {
      $priorActiveTab.get(0).scrollTop = 0;
    });
  }

  var i;
  if (_.isEqual(fmb.App.Routes.ACCOUNT, route)) {
    if (!this.viewAccount) {
      this.viewAccount = new fmb.views.Account({
        model: this.model.user
      });
      this.viewAccount.render();
    }
    newTab = 'account';
    newView = this.viewAccount;
    i = 1;

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
    i = 2;

  } else if (_.isEqual(fmb.App.Routes.HOW_IT_WORKS, route)) {
    if (!this.viewHowItWorks) {
      this.viewHowItWorks = new fmb.views.HowItWorks({
        model: this.model.user
      });
      this.viewHowItWorks.render();
    }
    newTab = 'how-it-works';
    newView = this.viewHowItWorks;
    i = 0;
  }

  this.$('.tabs .' + newTab).addClass('selected');
  this.$('.fmb-tab.fmb-tab-' + newTab).addClass('fmb-active');
  this.setCurrentView(newView, i);
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
    'change [name="allow_gmail_lookup"]': 'onChangeAllowGmailLookup_'
  }
});


/** @inheritDoc */
fmb.views.Account.prototype.initialize = function(options) {
  fmb.log('views.Account initialize');
  this.listenTo(this.model, 'change', this.render);

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

  // Make sure we're rendering devices for logged in users.
  this.$devices.toggle(this.model.id);

  var templateData = {
    'user': this.model.getTemplateData()
  };
  this.$account.html(fmb.views.getTemplateHtml('account', templateData));
  return this;
};


/**
 * @param {Backbone.Model} model A device model.
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
 * @param {Backbone.Model} model A device model.
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
};


/**
 * @param {Backbone.Model} model A backbone model.
 * @private
 */
fmb.views.Account.prototype.onRemoveDevice_ = function(model) {
  this.subViews_[model.cid] && this.subViews_[model.cid].remove();
  this.subViews_[model.cid] = null;
};


/**
 * @param {Event} e A click event.
 * @private
 */
fmb.views.Account.prototype.onChangeAllowGmailLookup_ = function(e) {
  fmb.log('fmb.views.Account onChangeAllowGmailLookup_');
  var $checkbox = $(e.target);
  var isAllowed = $checkbox.prop('checked');
  if (!isAllowed) {
    var confirm = window.confirm(
        'Ya sure you want to make your profile URL totally random?');
    if (!confirm) {
      $checkbox.prop('checked', true);
      return;
    }
  }

  this.model.save({
    'allow_gmail_lookup': isAllowed
  }, {
    success: function() {
      fmb.log('woot, changed allow_gmail_lookup');
    },
    error: function() {
      fmb.log('lame-o, failed to set allow_gmail_lookup to', isAllowed);
    }
  });
};


/**
 * @param {Event} e A click event.
 * @private
 */
fmb.views.Account.prototype.onClickLogin_ = function(e) {
  fmb.log('fmb.views.Account onClickLogin_');

  this.model.setLoginToken();

  var loginUrl = fmb.models.getServerShare() + '/login?user_token=' +
      window.escape(this.model.loginToken_);
  fmb.log('.. loginUrl:', loginUrl);
  this.inAppBrowser_ = window.open(
      loginUrl,
      '_blank',
      'location=yes,toolbar=no');

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
    if (!this.inAppBrowser_ || this.inAppBrowser_.closed) {
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
  fmb.views.showSpinner('Loading ...');

  if (e.url.indexOf('close=1') !== -1) {
    fmb.log('found close=1 in url, nukerooski.');
    this.inAppBrowser_.close();
    this.onInAppBrowserExit_();
  }
};


/**
 * @param {Event} e An event.
 * @private
 */
fmb.views.Account.prototype.onInAppBrowserLoadStop_ = function(e) {
  fmb.log('fmb.views.Account onInAppBrowserLoadStop_', e.url);

  fmb.views.hideSpinner();

  if (e.url.indexOf('/profile') !== -1) {
    this.inAppBrowser_.close();
    this.onInAppBrowserExit_();
  }
};


/**
 * @param {Event} e An event.
 * @private
 */
fmb.views.Account.prototype.onInAppBrowserExit_ = function(e) {
  fmb.log('fmb.views.Account onInAppBrowserExit_');

  fmb.views.hideSpinner();

  if (this.inAppBrowserCloseCheckInterval_ !== null) {
    window.clearInterval(this.inAppBrowserCloseCheckInterval_);
    this.inAppBrowserCloseCheckInterval_ = null;
  }

  if (!this.inAppBrowser_) {
    fmb.log('.. already exited, wtf.');
    return;
  }

  if (this.inAppBrowser_.removeEventListener) {
    this.inAppBrowser_.removeEventListener('loadstart',
        _.bind(this.onInAppBrowserLoadStop_, this));
    this.inAppBrowser_.removeEventListener('loadstop',
        _.bind(this.onInAppBrowserLoadStop_, this));
    this.inAppBrowser_.removeEventListener('exit',
        _.bind(this.onInAppBrowserExit_, this));
  }
  this.inAppBrowser_ = null;

  this.model.syncByLoginToken();
};


/******************************************************************************/



/**
 * @extends {Backbone.View}
 * @constructor
 */
fmb.views.HowItWorks = Backbone.View.extend({
  el: '.fmb-how-it-works'
});


/** @inheritDoc */
fmb.views.HowItWorks.prototype.render = function() {
  fmb.log('fmb.views.HowItWorks render');
  this.$el.html(fmb.views.getTemplateHtml('how_it_works', {}));
  return this;
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
  this.listenTo(this.model, 'change', _.debounce(this.render, this));
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
    'notifying': this.model.getTemplateData()
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
  if (fmb.ua.IS_APP) {
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


/** @type {number} */
fmb.views.Following.START_FETCH_DELAY = 500;


/**
 * @param {Boolean} isActive True for active.
 */
fmb.views.Following.prototype.setIsActive = function(isActive) {
  this.model.stopFetchPoll();
  this.user.stopFetchPoll();
  if (isActive) {
    _.delay(_.bind(function() {
      this.model.startFetchPoll(60 * 1000);
      this.user.startFetchPoll(60 * 1000);
    }, this), fmb.views.Following.START_FETCH_DELAY);
  }
};


/**
 * @param {Backbone.Model} model A model instance.
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


/**
 * @param {Backbone.Model} model A model instance.
 * @private
 */
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
 * @param {Backbone.Model} model A model instance.
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
  var templateData = this.model.getTemplateData();
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
  $(window).on('orientationchange',
      _.debounce(_.bind(this.renderGraph_, this), 1000));
  $(window).on('resize', _.debounce(_.bind(this.renderGraph_, this), 1000));
};


/** @inheritDoc */
fmb.views.FollowingDevice.prototype.render = function() {
  fmb.log('fmb.views.FollowingDevice render', this.model.id);
  var templateData = this.model.getTemplateData();
  if (app.model.user.device &&
      app.model.user.device.id == this.model.id) {
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
    fmb.log('No setting data to render chart with.');
    return;
  }

  // Sets the battery-graph el width dynamically since our chart
  // lib wants a px value.
  this.$('.battery-graph').css('width',
      this.$('.battery-graph').parent().width() - 10 + 'px');

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
    'dataFormatX': function(x) { return new Date(x); },
    'tickFormatX': function(x) { return d3.time.format('%a %I%p')(x); },
    'axisPaddingTop': 10,
    'axisPaddingBottom': 10,
    'axisPaddingLeft': 10,
    'axisPaddingRight': 10,
    'tickHintX': 4,
    'tickHintY': 2,
    'interpolation': 'basis',
    'yMin': 0
  };

  var chart = new xChart('line', data, '.battery-graph-' + this.model.id, opts);
};

