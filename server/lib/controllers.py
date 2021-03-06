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
from lib.web_request_handler import ErrorNotFoundRequestHandler
from lib.web_request_handler import ErrorInternalRequestHandler

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
    Route('/api/device/delete', handler='lib.api.ApiDeviceDeleteHandler'),
    Route('/api/device', handler='lib.api.ApiDeviceHandler'),
    Route('/api/following/delete',
          handler='lib.api.ApiFollowingDeleteHandler'),
    Route('/api/following', handler='lib.api.ApiFollowingHandler'),
    Route('/api/notifying/delete',
          handler='lib.api.ApiNotifyingDeleteHandler'),
    Route('/api/notifying', handler='lib.api.ApiNotifyingHandler'),
    Route('/api/settings', handler='lib.api.ApiSettingsHandler'),
    # Deprecate gcm_push_token
    Route('/api/user/gcm_push_token',
          handler='lib.api.ApiUserGCMPushTokenHandler'),
    Route('/api/user/token', handler='lib.api.ApiUserTokenHandler'),
    Route('/api/user', handler='lib.api.ApiUserHandler'),
    Route('/api/settings_caused_battery_notifications',
          handler='lib.api.ApiSettingsCausedBatteryNotificationsHandler'),

    # AUTH
    Route('/login', handler='lib.auth.LoginHandler'),
    Route('/logout', handler='lib.auth.AuthHandler:logout', name='logout'),
    Route('/auth/google/code_exchange',
          handler='lib.auth.AuthHandler:_google_code_exchange'),
    Route('/auth/<provider>', handler='lib.auth.AuthHandler:_simple_auth',
          name='auth_login'),
    Route('/auth/<provider>/callback',
          handler='lib.auth.AuthHandler:_auth_callback',
          name='auth_callback'),

    # Admin
    Route('/admin/user_message_test',
          handler='lib.admin.AdminUserMessageTestHandler'),
    Route('/admin/users', handler='lib.admin.AdminUsersHandler'),
    Route('/admin/api_request', handler='lib.admin.AdminApiHandler'),
    Route('/admin/tinker', handler='lib.admin.AdminTinkerHandler'),


    # Glassware
    Route('/glassware', handler='lib.glassware.GlasswareHandler'),
    Route('/glassware/notify', handler='lib.glassware.GlasswareNotifyHandler'),

    # WWW
    Route('/p/<unique_profile_str>', handler='lib.www.ProfileHandler'),
    Route('/profile', handler='lib.www.ProfileHandler'),
    Route('/support', handler='lib.www.SupportHandler'),


    # App
    Route('/app', handler='lib.www.AppHandler'),
    Route('/app/<endpoint>', handler='lib.www.AppHandler'),
    Route('/app/<endpoint>/<more_endpoint>', handler='lib.www.AppHandler'),

    Route('/', handler='lib.www.IndexHandler'),
]

is_debug = False
if 'SERVER_SOFTWARE' in os.environ:
    is_debug = 'Development' in os.environ['SERVER_SOFTWARE']

app = webapp2.WSGIApplication(routes, config=app_config,
                              debug=is_debug)

app.error_handlers[404] = ErrorNotFoundRequestHandler
#app.error_handlers[500] = ErrorInternalRequestHandler
