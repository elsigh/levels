#!/usr/bin/python2.7
#
#

import json
import logging
import os
import sys
import webapp2
from webapp2 import Route

sys.path.append(os.path.join(os.path.dirname(__file__), 'external'))

# last import.
import settings


# webapp2 config
app_config = {
  'webapp2_extras.sessions': {
    'cookie_name': '_simpleauth_sess',
    'secret_key': settings.SESSION_KEY
  },
  'webapp2_extras.auth': {
    'user_attributes': []
  }
}

routes = [
    # API
    Route('/api/user/device/<uuid>', handler='lib.api.ApiUserDeviceRequestHandler'),
    Route('/api/user/<key>', handler='lib.api.ApiUserRequestHandler'),
    #Route('/api/user/(.*)', handler='lib.api.ApiUserRequestHandler'),
    Route('/api/device/<uuid>', handler='lib.api.ApiDeviceRequestHandler'),
    Route('/api/settings/<uuid>', handler='lib.api.ApiSettingsRequestHandler'),
    Route('/api/following/delete/<key>', handler='lib.api.ApiFollowingDeleteRequestHandler'),
    Route('/api/following/<key>', handler='lib.api.ApiFollowingRequestHandler'),
    Route('/api/notifying/delete/<device_key>', handler='lib.api.ApiNotifyingDeleteRequestHandler'),
    Route('/api/notifying/<device_key>', handler='lib.api.ApiNotifyingRequestHandler'),

    # AUTH
    Route('/login', handler='lib.auth.RootHandler'),
    Route('/logout', handler='lib.auth.AuthHandler:logout', name='logout'),
    Route('/auth/<provider>', handler='lib.auth.AuthHandler:_simple_auth',
          name='auth_login'),
    Route('/auth/<provider>/callback',
          handler='lib.auth.AuthHandler:_auth_callback',
          name='auth_callback'),

    # WWW
    Route('/profile/<key>', handler='lib.www.ProfileHandler'),
    Route('/profile', handler='lib.www.ProfileHandler'),
]

app = webapp2.WSGIApplication(routes, config=app_config, debug=True)
