
/*** UNIT TEST ***/

var API_RESPONSE_HEADERS = {
  'Content-Type': 'application/json'
};

var app;
var clock;
var server;

// Don't rewrite our URLs
sinon.stub(window.history, 'pushState');
sinon.stub(window, 'open', function() { return {}; });
sinon.stub(window, 'confirm', function() { return true; });
sinon.stub(cordova, 'require');

function setUp() {
  localStorage.clear();
  app = null;
  clock = sinon.useFakeTimers(1269104389306);
  server = sinon.fakeServer.create();
}

function tearDown() {
  localStorage.clear();
  clock.restore();
  server.restore();
}

/*************************************************************************/


// This is one honkin long test with lots of stuff in it.
function testApp() {
  var serverRequestCountExpected = 0;
  clock.tick(1000000);  // get us into sane clock land.

  app = new fmb.App();
  clock.tick(5000);  // init
  assertTrue(app.view.currentView instanceof fmb.views.Account);
  var user = app.model.user;
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

  // Tests that the device rendered with its notification view.
  assertEquals(1, app.view.currentView.$('.fmb-device').length);
  assertEquals(1, app.view.currentView.$('.fmb-device .fmb-notifying').length);

  // Ensures our identity map is setup properly
  assertTrue(app.model.user.device === app.model.user.get('devices').at(0));


/******************************************************************************/


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


/******************************************************************************/


  // Tests that we can remove users from the notification collection.
  app.model.user.device.get('notifying').remove('test_notify_key');
  serverRequestCountExpected++;
  assertEquals(fmb.models.getApiUrl('/notifying/delete'),
               server.requests[serverRequestCountExpected - 1].url);

  var deleteRequestData =
      JSON.parse(server.requests[serverRequestCountExpected - 1].requestBody);
  assertTrue('key' in deleteRequestData);

  var notifyDeleteResponse = {
    'status': 0
  };
  server.requests[serverRequestCountExpected - 1].respond(
      200, API_RESPONSE_HEADERS,
      JSON.stringify(notifySaveResponse));
  assertEquals(0, app.model.user.device.get('notifying').length);


/******************************************************************************/


  // Tests that we can have and delete another device.
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

  app.view.currentView.$('.fmb-device .fmb-remove').trigger('tap');

  serverRequestCountExpected++;
  assertEquals(fmb.models.getApiUrl('/device/delete'),
               server.requests[serverRequestCountExpected - 1].url);
  server.requests[serverRequestCountExpected - 1].respond(
      200, API_RESPONSE_HEADERS,
      JSON.stringify({'status': 0}));
  assertEquals(1, app.model.user.get('devices').length);
  assertEquals(1, app.view.currentView.$('.fmb-device').length);


/******************************************************************************/

  assertEquals(serverRequestCountExpected, server.requests.length);
  fmb.log('OKOKOKOKOKOKOKOKOKOKOKOKOKOK')

  // OK  - navigate to the following tab.
  $('.tabs .following').trigger('tap');
  assertTrue(app.view.currentView instanceof fmb.views.Following);

  // Starts a fetch on both following and user.
  serverRequestCountExpected += 2;
  assertEquals(serverRequestCountExpected, server.requests.length);

  // It's our own device.
  assertEquals(1, app.view.currentView.$('.fmb-following-user').length);
  assertEquals(1, app.view.currentView.$('.fmb-following-device').length);

  // Should not be able to remove yourself.
  assertEquals(0, app.view.currentView.$('.fmb-following-user .remove').length);

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


  // Tests our following "addByKey" functionality.
  app.model.user.get('following').addByKey('following_user_1_key');
  serverRequestCountExpected++;
  assertEquals(fmb.models.getApiUrl('/following'),
               server.requests[serverRequestCountExpected - 1].url);

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

  // Tries out some following users in the response.
  // Note - here we're *not* sending back the new followed user as
  // the datastore hasn't quite finished with eventual consistency ;/
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
  assertEquals('70%', $(app.view.currentView.$(
      '.fmb-following-device .battery-level')[0]).text().trim());
  assertEquals('35%', $(app.view.currentView.$(
      '.fmb-following-device .battery-level')[1]).text().trim());
  assertEquals('65%', $(app.view.currentView.$(
      '.fmb-following-device .battery-level')[2]).text().trim());


  // Ensures that new battery stats end up being rendered.
  clock.tick(1000);
  fmb.App.onBatteryStatus_({
    'level': 40,
    'isPlugged': true
  });
  clock.tick(2000);  // render/renderGraph is deferred
  assertEquals('40%', $(app.view.currentView.$(
      '.fmb-following-device .battery-level')[0]).text().trim());
}
