

var API_RESPONSE_HEADERS = {
  'Content-Type': 'application/json'
};

var app;
var clock;
var server;

// Don't rewrite our URLs
sinon.stub(window.history, 'pushState');
sinon.stub(window, 'open', function() { return {}; });
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

function testApp() {
  clock.tick(1000000);  // get us into sane clock land.

  app = new fmb.App();
  clock.tick(5000);  // init
  assertTrue(app.view.currentView instanceof fmb.views.Account);
  var user = app.model.user;
  app.view.currentView.onClickLogin_();    // start oauth.
  assertEquals(1, window.open.callCount);
  app.view.currentView.onLoginRefExit_();  // oauth done.
  assertEquals(1, server.requests.length);
  assertEquals(fmb.models.getApiUrl('/user/token'),
               server.requests[0].url);

  var userTokenResponse = {
    'status': 0,
    'key': 'test_user_key',
    'api_token': 'test_api_token',
    'name': 'test_user_name'
  };
  server.requests[0].respond(200, API_RESPONSE_HEADERS,
       JSON.stringify(userTokenResponse));
  assertUndefined(app.model.user.get('user_token'));  // now undefined.
  assertEquals(userTokenResponse['key'], app.model.user.get('key'));
  assertEquals(userTokenResponse['key'],
               localStorage.getItem('user_key'));
  assertEquals(userTokenResponse['api_token'], app.model.user.get('api_token'));
  assertEquals(userTokenResponse['name'],
               app.view.currentView.$el.find('h3').text());

  assertEquals(2, server.requests.length);
  assertEquals(fmb.models.getApiUrl('/device'),
               server.requests[1].url);

  var deviceResponse = {
    'status': 0,
    'key': 'test_device_key'
  };
  server.requests[1].respond(200, API_RESPONSE_HEADERS,
       JSON.stringify(deviceResponse));
  assertEquals(deviceResponse['key'],
               app.model.user.get('devices').at(0).get('key'));
  assertEquals(deviceResponse['key'],
               app.model.user.device.get('key'));
  assertEquals(deviceResponse['key'],
               localStorage.getItem('device_key'));
  clock.tick(1);

  // Tests that the device rendered with its notification view.
  assertEquals(1, app.view.currentView.$('.fmb-device').length);
  assertEquals(1, app.view.currentView.$('.fmb-device .fmb-notifying').length);

  // OK  - navigate to the following tab.
  $('.tabs .following').trigger('tap');
  assertTrue(app.view.currentView instanceof fmb.views.Following);

  // It's our own device.
  assertEquals(1, app.view.currentView.$('.fmb-following-user').length);
  assertEquals(1, app.view.currentView.$('.fmb-following-device').length);

  // Now fire a battery_status event and test that it both updates our
  // local reference to the device as well as the identity mapped one in
  // the devices collection and draws it on the screen.
  fmb.App.onBatteryStatus_({
    'level': 80,
    'isPlugged': false
  });
  assertEquals('80%', app.view.currentView.$(
      '.fmb-following-device .battery-level').text().trim());

  // Ensure no-op following fetch leaves current device in view.
  app.model.user.get('following').fetch();
  var expectedUrl = fmb.models.getApiUrl('/following') + '?' +
      'api_token=' + app.model.user.get('api_token') + '&' +
      'user_key=' + app.model.user.id;
  assertEquals(expectedUrl,
               server.requests[2].url);

  var followingResponse = {
    'status': 0,
    'following': []
  };
  server.requests[2].respond(200, API_RESPONSE_HEADERS,
       JSON.stringify(followingResponse));

  // aka nothing changed.
  assertEquals(1, app.view.currentView.$('.fmb-following-user').length);
  assertEquals(1, app.view.currentView.$('.fmb-following-device').length);
  assertEquals('80%', app.view.currentView.$(
      '.fmb-following-device .battery-level').text().trim());

  // Tries out some following users in the response.
  app.model.user.get('following').fetch();


  followingResponse = {
    'status': 0,
    'following': [
      {
        'key': 'following_user_1_key',
        'name': 'following_user_1',
        'devices': [
          {
            'key': 'following_device_1_key',
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
  server.requests[3].respond(200, API_RESPONSE_HEADERS,
       JSON.stringify(followingResponse));

  // UI updates
  assertEquals(2, app.view.currentView.$('.fmb-following-user').length);
  assertEquals(2, app.view.currentView.$('.fmb-following-device').length);
  assertEquals('80%', $(app.view.currentView.$(
      '.fmb-following-device .battery-level')[0]).text().trim());
  assertEquals('65%', $(app.view.currentView.$(
      '.fmb-following-device .battery-level')[1]).text().trim());

}
