
/*** UNIT TEST ***/

var API_RESPONSE_HEADERS = {
  'Content-Type': 'application/json'
};

var app;
var clock;
var server;
var serverRequestCountExpected;
var initialAppHtml;

// Don't rewrite our URLs
sinon.stub(window.history, 'pushState');
sinon.stub(window, 'open', function() { return {}; });
sinon.stub(window, 'confirm', function() { return true; });

sinon.stub(cordova, 'addConstructor');
sinon.stub(cordova, 'define');
sinon.stub(cordova, 'require');

function setUp() {
  if (!initialAppHtml) {
    initialAppHtml = $('.fmb-app').html();
  }
  app = null;
  localStorage.clear();
  clock = sinon.useFakeTimers(1269104389306);
  clock.tick(1000000);  // get us into sane clock land.
  server = sinon.fakeServer.create();
  serverRequestCountExpected = 0;
  fmb.log('***************************************************************');
}

function tearDown() {
  $('.fmb-app').html(initialAppHtml);  // reset to cleanliness
  app = null;
  Backbone.history.stop();
  Backbone.IdentityMap.resetCache();
  localStorage.clear();
  clock.restore();
  server.restore();
}


/*************************************************************************/

function setUpAppNewInstall() {
  app = new fmb.App();
  clock.tick(5000);  // init
  assertTrue(app.view.currentView instanceof fmb.views.Account);
}


/*************************************************************************/

function testNewInstallAndUserLogin() {
  setUpAppNewInstall();
  app.view.currentView.onClickLogin_();    // start oauth.
  assertEquals(1, window.open.callCount);
  app.view.currentView.onInAppBrowserExit_();  // oauth done.

  serverRequestCountExpected++;
  assertEquals(serverRequestCountExpected, server.requests.length);
  assertEquals(fmb.models.getApiUrl('/user/token'),
               server.requests[serverRequestCountExpected - 1].url);

  var userTokenResponse = {
    'status': 0,
    'key': 'test_user_key',
    'api_token': 'test_api_token',
    'name': 'test_user_name'
  };
  server.requests[serverRequestCountExpected - 1].respond(
      200, API_RESPONSE_HEADERS,
      JSON.stringify(userTokenResponse));
  assertUndefined(app.model.user.get('user_token'));  // now undefined.
  assertEquals(userTokenResponse['key'], app.model.user.get('key'));
  assertEquals(userTokenResponse['key'],
               localStorage.getItem('user_key'));

  assertEquals(userTokenResponse['api_token'], app.model.user.get('api_token'));
  assertEquals(userTokenResponse['name'],
               app.view.currentView.$el.find('h2').text());

  // userTokenResponse causes the current device to be saved to the server.
  serverRequestCountExpected++;
  assertEquals(serverRequestCountExpected, server.requests.length);
  assertEquals(fmb.models.getApiUrl('/device'),
               server.requests[serverRequestCountExpected - 1].url);

  sinon.spy(app.model.user, 'setUserDevice');

  // Ensures we pass up api_token and user_key in the body here.
  var deviceBody = JSON.parse(
      server.requests[serverRequestCountExpected - 1].requestBody);
  assertEquals(app.model.user.get('api_token'),
               deviceBody['api_token']);
  assertEquals(app.model.user.id,
               deviceBody['user_key']);

  var deviceResponse = {
    'status': 0,
    'key': 'test_device_key'
  };
  server.requests[serverRequestCountExpected - 1].respond(
      200, API_RESPONSE_HEADERS,
      JSON.stringify(deviceResponse));

  assertEquals(deviceResponse['key'],
               app.model.user.get('devices').at(0).get('key'));
  assertEquals(deviceResponse['key'],
               app.model.user.device.get('key'));
  assertEquals(1, app.model.user.setUserDevice.callCount);

  // Tests that the device rendered with its notification view.
  assertEquals(1, app.view.currentView.$('.fmb-device').length);
  assertEquals(1, app.view.currentView.$('.fmb-device .fmb-notifying').length);

  // Ensures our identity map is setup properly
  assertTrue(app.model.user.device === app.model.user.get('devices').at(0));
}


/******************************************************************************/


function setUpAppInstalled() {
  var testUser = new fmb.models.User({
    'key': 'test_user_key',
    'api_token': 'test_user_api_token',
    'name': 'Lindsey Simon',
    'email': 'elsigh@gmail.com',
    'unique_profile_str': 'elsigh',
    'devices': [
      {
        'key': 'test_user_device_key',
        'uuid': fmb.models.DeviceUnMapped.getUuid(),
        'name': 'test_user_device_name',
        'platform': 'test_user_device_platform',
        'version': 'test_user_device_version',
        'notifying': [],
        'settings': []
      }
    ]
  });
  testUser.saveToStorage();
  localStorage.setItem('user_key', testUser.id);
  clock.tick(1000);
  Backbone.IdentityMap.resetCache();

  app = new fmb.App();
  clock.tick(5000);  // init

  serverRequestCountExpected++;  // First request is a user fetch / sync.

}

/******************************************************************************/

function testAppInstalledInitialize() {
  setUpAppInstalled();
  assertEquals('test_user_key', app.model.user.id);
  assertEquals('Lindsey Simon', app.model.user.get('name'));
  assertEquals('test_user_key', fmb.models.sync.userKey);

  // Ensures our identity map is setup properly
  assertTrue(app.model.user.device === app.model.user.get('devices').at(0));

  // Ensure we mapped the user device to our static var.
  assertEquals('test_user_device_name', app.model.user.device.get('name'));

  // First request is a user sync.
  var userSyncUrl = fmb.models.getApiUrl('/user') +
      '?api_token=' + app.model.user.get('api_token') + '&' +
      'user_key=' + app.model.user.id;
  assertEquals(userSyncUrl,
               server.requests[serverRequestCountExpected - 1].url);
  /*
  assertEquals(fmb.models.getApiUrl('/user'),
               server.requests[serverRequestCountExpected - 1].url);
  var requestBody =
      JSON.parse(server.requests[serverRequestCountExpected - 1].requestBody);
  assertEquals(app.model.user.get('api_token'), requestBody['api_token']);
  assertEquals(app.model.user.id, requestBody['user_key']);
  */

  var userSyncResponse = {
    'status': 0,
    'name': 'Lindsey Simon'
  };
  server.requests[serverRequestCountExpected - 1].respond(
      200, API_RESPONSE_HEADERS,
      JSON.stringify(userSyncResponse));
}

/******************************************************************************/

function testNotifyingAdd() {
  setUpAppInstalled();
  // Tests that we can add to the notification collection.
  app.model.user.device.get('notifying').add({
    'name': 'test_notify_name',
    'means': 'test_notify_means',
    'type': 'phone'
  });
  serverRequestCountExpected++;
  assertEquals(fmb.models.getApiUrl('/notifying'),
               server.requests[serverRequestCountExpected - 1].url);

  // client already has notify model.
  var notifyModel = app.model.user.device.get('notifying').at(0);
  assertObjectEquals({
    'cid': notifyModel.cid,
    'name': 'test_notify_name',
    'means': 'test_notify_means',
    'type': 'phone',
    'device_key': app.model.user.device.get('key'),
    'api_token': app.model.user.get('api_token'),
    'user_key': app.model.user.id
  }, JSON.parse(server.requests[serverRequestCountExpected - 1].requestBody));

  var notifySaveResponse = {
    'status': 0,
    'key': 'test_notify_key',
    'cid': notifyModel.cid,
    'name': 'test_notify_name',
    'means': 'test_notify_means',
    'type': 'phone'
  };
  server.requests[serverRequestCountExpected - 1].respond(
      200, API_RESPONSE_HEADERS,
      JSON.stringify(notifySaveResponse));
}

/******************************************************************************/

function testNotifyingDelete() {
  // Tests that we can remove users from the notification collection.
  testNotifyingAdd();
  app.model.user.device.get('notifying').remove('test_notify_key');
  serverRequestCountExpected++;
  assertEquals(fmb.models.getApiUrl('/notifying/delete'),
               server.requests[serverRequestCountExpected - 1].url);

  var deleteRequestData =
      JSON.parse(server.requests[serverRequestCountExpected - 1].requestBody);
  assertEquals('test_notify_key', deleteRequestData['key']);

  var notifyDeleteResponse = {
    'status': 0
  };
  server.requests[serverRequestCountExpected - 1].respond(
      200, API_RESPONSE_HEADERS,
      JSON.stringify(notifyDeleteResponse));
  assertEquals(0, app.model.user.device.get('notifying').length);
}

/******************************************************************************/

function testMultipleDevices() {
  setUpAppInstalled();
  app.model.user.fetch();
  serverRequestCountExpected++;
  var expectedUrl = fmb.models.getApiUrl('/user') + '?' +
      'api_token=' + app.model.user.get('api_token') + '&' +
      'user_key=' + app.model.user.id;
  assertEquals(expectedUrl,
               server.requests[serverRequestCountExpected - 1].url);

  var userFetchResponse = fmb.clone(app.model.user.toJSON());
  userFetchResponse['devices'].push({
    'key': 'test_device2_key',
    'name': 'test_device2_name'
  });
  server.requests[serverRequestCountExpected - 1].respond(
      200, API_RESPONSE_HEADERS,
      JSON.stringify(userFetchResponse));
  assertEquals(2, app.model.user.get('devices').length);
  assertEquals(2, app.view.currentView.$('.fmb-device').length);
  // Only the new one is deletable.
  assertEquals(1, app.view.currentView.$('.fmb-device .fmb-remove').length);
}

/******************************************************************************/

function testDeleteNonUserDevice() {
  testMultipleDevices();
  app.view.currentView.$('.fmb-device .fmb-remove').trigger('tap');

  serverRequestCountExpected++;
  assertEquals(fmb.models.getApiUrl('/device/delete'),
               server.requests[serverRequestCountExpected - 1].url);
  server.requests[serverRequestCountExpected - 1].respond(
      200, API_RESPONSE_HEADERS,
      JSON.stringify({'status': 0}));
  assertEquals(1, app.model.user.get('devices').length);
  assertEquals(1, app.view.currentView.$('.fmb-device').length);
}

/******************************************************************************/


function testInitialFollowingView() {
  setUpAppInstalled();
  // OK  - navigate to the following tab.
  $('.tabs .following').trigger('tap');
  assertTrue(app.view.currentView instanceof fmb.views.Following);

  // Starts a fetch on both following and user.
  serverRequestCountExpected += 2;

  // It's our own device.
  assertEquals(1, app.view.currentView.$('.fmb-following-user').length);
  assertEquals(1, app.view.currentView.$('.fmb-following-device').length);

  // Should not be able to remove yourself.
  assertEquals(0, app.view.currentView.$('.fmb-following-user .remove').length);
}

function testUserDeviceBatteryStatusUpdatesFollowingView() {
  testInitialFollowingView();

  // Now fire a battery_status event and test that it both updates our
  // local reference to the device as well as the identity mapped one in
  // the devices collection and draws it on the screen.
  fmb.App.onBatteryStatus_({
    'level': 80,
    'isPlugged': false
  });
  clock.tick(2000);  // render/renderGraph is deferred
  assertEquals('80%', app.view.currentView.$(
      '.fmb-following-device .battery-level').text().trim());

  clock.tick(5000);

  fmb.App.onBatteryStatus_({
    'level': 70,
    'isPlugged': false
  });
  clock.tick(2000);  // render/renderGraph is deferred
  assertEquals('70%', app.view.currentView.$(
      '.fmb-following-device .battery-level').text().trim());

  clock.tick(5000);

  fmb.App.onBatteryStatus_({
    'level': 70,
    'isPlugged': false
  });
  clock.tick(2000);  // render/renderGraph is deferred
  assertEquals('70%', app.view.currentView.$(
      '.fmb-following-device .battery-level').text().trim());

  // Ensure no-op following fetch leaves current device in view.
  app.model.user.get('following').fetch();
  serverRequestCountExpected++;

  var expectedUrl = fmb.models.getApiUrl('/following') + '?' +
      'api_token=' + app.model.user.get('api_token') + '&' +
      'user_key=' + app.model.user.id;
  assertEquals(expectedUrl,
               server.requests[serverRequestCountExpected - 1].url);

  var followingResponse = {
    'status': 0,
    'following': []
  };
  server.requests[serverRequestCountExpected - 1].respond(
      200, API_RESPONSE_HEADERS,
      JSON.stringify(followingResponse));
  assertEquals(serverRequestCountExpected, server.requests.length);

  // aka nothing changed.
  assertEquals(1, app.view.currentView.$('.fmb-following-user').length);
  assertEquals(1, app.view.currentView.$('.fmb-following-device').length);
  assertEquals('70%', app.view.currentView.$(
      '.fmb-following-device .battery-level').text().trim());

}

/******************************************************************************/

function testFollowingAddByUniqueProfileStr() {
  testInitialFollowingView();

  app.model.user.get('following').addByUniqueProfileStr('gelabella');
  serverRequestCountExpected++;
  assertEquals(fmb.models.getApiUrl('/following'),
               server.requests[serverRequestCountExpected - 1].url);

  var requestBody =
      JSON.parse(server.requests[serverRequestCountExpected - 1].requestBody);
  assertEquals('gelabella', requestBody['following_user_unique_profile_str']);

  // Shows basic info about some new user in the UI.
  assertEquals(2, app.view.currentView.$('.fmb-following-user').length);

  clock.tick(1000);  // trigger deferreds

  var followingAddResponse = {
    'status': 0,
    'key': 'following_user_1_key',
    'name': 'following_user_1_name',
    'devices': [
      {
        'key': 'following_user_1_device_1_key',
        'platform': 'Android',
        'name': 'keekee',
        'settings': [
          {
            'key': 'following_user_1_device_1_settings_1',
            'created': fmb.models.getISODate(
                new Date(Date.now() - 60 * 1000 * 1)),
            'battery_level': 35,
            'is_charging': false
          }
        ]
      }
    ]
  };
  server.requests[serverRequestCountExpected - 1].respond(
      200, API_RESPONSE_HEADERS,
      JSON.stringify(followingAddResponse));
  clock.tick(2000);  // render/renderGraph is deferred

  assertEquals(1, app.model.user.get('following').length);

  var $newFollowingUser = $(app.view.currentView.$(
      '.fmb-following-user')[1]);
  assertEquals('following_user_1_name',
      $($newFollowingUser.find('h2')).text().trim());
}

/******************************************************************************/

function testFollowingSync() {
  testFollowingAddByUniqueProfileStr();
  // Tries out some following users in the response.
  // Note - here we're *not* sending back the new followed user to mimic
  // the datastore reality of eventual consistency ;/
  app.model.user.get('following').fetch();
  serverRequestCountExpected++;

  followingResponse = {
    'status': 0,
    'following': [
      {
        'key': 'following_user_2_key',
        'name': 'following_user_2_name',
        'devices': [
          {
            'key': 'following_user_2_device_1_key',
            'platform': 'Android',
            'name': 'kokomo',
            'settings': [
              {
                'key': 'following_settings_1',
                'created': fmb.models.getISODate(
                    new Date(Date.now() - 60 * 1000 * 1)),
                'battery_level': 65,
                'is_charging': false
              },

              {
                'key': 'following_settings_2',
                'created': fmb.models.getISODate(
                    new Date(Date.now() - 60 * 1000 * 1 * 10)),
                'battery_level': 45,
                'is_charging': false
              },

              {
                'key': 'following_settings_3',
                'created': fmb.models.getISODate(
                    new Date(Date.now() - 60 * 1000 * 20)),
                'battery_level': 35,
                'is_charging': true
              },

              {
                'key': 'following_settings_4',
                'created': fmb.models.getISODate(
                    new Date(Date.now() - 60 * 1000 * 30)),
                'battery_level': 75,
                'is_charging': false
              }
            ]
          }
        ]
      }
    ]
  };
  server.requests[serverRequestCountExpected - 1].respond(
      200, API_RESPONSE_HEADERS,
      JSON.stringify(followingResponse));
  clock.tick(2000);  // render/renderGraph is deferred


  // UI updates
  assertEquals(3, app.view.currentView.$('.fmb-following-user').length);
  assertEquals(3, app.view.currentView.$('.fmb-following-device').length);
  assertEquals(2, app.view.currentView.$('.fmb-following-user .fmb-remove').length);

  assertEquals('35%', $(app.view.currentView.$(
      '.fmb-following-device .battery-level')[1]).text().trim());
  assertEquals('65%', $(app.view.currentView.$(
      '.fmb-following-device .battery-level')[2]).text().trim());

  // Need data for the user device to be set.
  fmb.App.onBatteryStatus_({
    'level': 70,
    'isPlugged': false
  });
  clock.tick(2000);  // render/renderGraph is deferred
  assertEquals('70%', $(app.view.currentView.$(
      '.fmb-following-device .battery-level')[0]).text().trim());
}


/******************************************************************************/


function testAppIncompleteInstall() {
  var testUser = new fmb.models.User({
    'key': 'test_user_key',
    'api_token': 'test_user_api_token',
    'name': 'Lindsey Simon',
    'email': 'elsigh@gmail.com',
    'unique_profile_str': 'elsigh'
  });
  testUser.saveToStorage();
  localStorage.setItem('user_key', testUser.id);
  clock.tick(1000);
  Backbone.IdentityMap.resetCache();

  app = new fmb.App();
  clock.tick(5000);  // init

  // First request is a user sync.
  serverRequestCountExpected++;
  var userSyncUrl = fmb.models.getApiUrl('/user') +
      '?api_token=' + app.model.user.get('api_token') + '&' +
      'user_key=' + app.model.user.id;
  assertEquals(userSyncUrl,
               server.requests[serverRequestCountExpected - 1].url);

  server.requests[serverRequestCountExpected - 1].respond(
      200, API_RESPONSE_HEADERS,
      JSON.stringify({'status': 0}));

  serverRequestCountExpected++;  // Retry createUserDevice
  assertEquals(fmb.models.getApiUrl('/device'),
               server.requests[serverRequestCountExpected - 1].url);

}

