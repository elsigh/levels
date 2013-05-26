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

from lib.models import FMBUser

from google.appengine.ext import deferred
# Hack to get ndb into the modules list.
from google.appengine.ext import ndb
sys.modules['ndb'] = ndb

# last import.
import settings


# webapp2 config
app_config = {
  'webapp2_extras.sessions': {
    'cookie_name': '_simpleauth_sess',
    'secret_key': settings.SESSION_KEY
  },
  'webapp2_extras.auth': {
    'user_attributes': [],
    'user_model': FMBUser
  }
}

routes = [
    # API
    Route('/api/user/token', handler='lib.api.ApiUserTokenHandler'),
    Route('/api/user', handler='lib.api.ApiUserHandler'),
    Route('/api/device', handler='lib.api.ApiDeviceHandler'),
    Route('/api/device/delete', handler='lib.api.ApiDeviceDeleteHandler'),
    Route('/api/settings', handler='lib.api.ApiSettingsHandler'),
    Route('/api/following/delete', handler='lib.api.ApiFollowingDeleteHandler'),
    Route('/api/following', handler='lib.api.ApiFollowingHandler'),
    Route('/api/notifying/delete', handler='lib.api.ApiNotifyingDeleteHandler'),
    Route('/api/notifying', handler='lib.api.ApiNotifyingHandler'),

    # AUTH
    Route('/login', handler='lib.auth.LoginHandler'),
    Route('/logout', handler='lib.auth.AuthHandler:logout', name='logout'),
    Route('/auth/<provider>', handler='lib.auth.AuthHandler:_simple_auth',
          name='auth_login'),
    Route('/auth/<provider>/callback',
          handler='lib.auth.AuthHandler:_auth_callback',
          name='auth_callback'),

    # WWW
    Route('/profile/<user_key>', handler='lib.www.ProfileHandler'),
    Route('/profile', handler='lib.www.ProfileHandler'),
]

app = webapp2.WSGIApplication(routes, config=app_config, debug=True)
