

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
  app = null;
  clock = sinon.useFakeTimers();
  server = sinon.fakeServer.create();
}

function tearDown() {
  localStorage.clear();
  clock.restore();
  server.restore();
}

/*************************************************************************/

function testApp() {
  app = new fmb.App();
  clock.tick(5000);  // init
  assertTrue(app.view.currentView instanceof fmb.views.Account)
  var user = app.model.user;
  app.view.currentView.onClickLogin_();    // start oauth.
  assertEquals(1, window.open.callCount);
  app.view.currentView.onLoginRefExit_();  // oauth done.
  assertEquals(1, server.requests.length);
  assertEquals(fmb.models.getApiUrl('/user/token'),
               server.requests[0].url);

  var userTokenResponse = {
    'status': 0,
    'id': 1,
    'key': 'test_user_key',
    'api_token': 'test_api_token',
    'name': 'test_user_name'
  };
  server.requests[0].respond(200, API_RESPONSE_HEADERS,
       JSON.stringify(userTokenResponse));
  assertUndefined(app.model.user.get('user_token'));  // now undefined.
  assertEquals(userTokenResponse['id'], app.model.user.get('id'));
  assertEquals(userTokenResponse['id'].toString(),
               localStorage.getItem('user_id'));
  assertEquals(userTokenResponse['api_token'], app.model.user.get('api_token'));
  assertEquals(userTokenResponse['name'],
               app.view.currentView.$el.find('h2').text());

  assertEquals(2, server.requests.length);
  assertEquals(fmb.models.getApiUrl('/device'),
               server.requests[1].url);

  var deviceResponse = {
    'status': 0,
    'id': 10,
    'key': 'test_device_key'
  };
  server.requests[1].respond(200, API_RESPONSE_HEADERS,
       JSON.stringify(deviceResponse));
  assertEquals(deviceResponse['id'],
               app.model.user.get('devices').at(0).get('id'));
  assertEquals(deviceResponse['id'],
               app.model.device.get('id'));
  assertEquals(deviceResponse['id'].toString(),
               localStorage.getItem('device_id'));

}

