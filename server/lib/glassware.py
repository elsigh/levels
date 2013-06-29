#!/usr/bin/python2.7
#


import datetime
import json
import httplib2
import logging
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), 'external'))

from lib.web_request_handler import WebRequestHandler

from google.appengine.api import users
from google.appengine.ext import ndb
sys.modules['ndb'] = ndb

import webapp2
from webapp2_extras.appengine.users import admin_required

from lib import models
from lib.auth import login_required
from lib.external.apiclient.discovery import build
from lib.external.oauth2client.client import OAuth2Credentials

# last import.
import settings


class GlasswareHandler(WebRequestHandler):

    @property
    def mirror_service(self):
        http = httplib2.Http()
        self.credentials.authorize(http)
        return build('mirror', 'v1', http=http)

    @property
    def credentials(self):
        u = self.current_user
        return OAuth2Credentials(
            u.oauth2_access_token,
            settings.GOOGLE_APP_ID,
            settings.GOOGLE_APP_SECRET,
            u.oauth2_refresh_token,
            u.oauth2_expires_datetime,
            token_uri='https://accounts.google.com/o/oauth2/token',
            user_agent=settings.USER_AGENT)

    @admin_required
    @login_required
    def get(self):
        mirror_service = self.mirror_service

        self.output_response({
            'title': 'Levels Admin: Tinker',
            'mirror_service': mirror_service
        }, 'glassware.html')
