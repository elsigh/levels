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


class GlasswareWebRequestHandler(WebRequestHandler):

    def _insert_subscription(self):
        """Subscribe the app."""
        for userid in self.current_user.google_auth_ids:
            body = {
                'collection': 'timeline',
                'userToken': userid,
                'callbackUrl': self.get_full_url('/glassware/notify')
            }
            result = None
            try:
                logging.info('GLASSWARE SUBSCRIBE user: %s, body: %s' %
                             (userid, body))
                result = self.mirror_service.subscriptions().insert(
                    body=body).execute()
            except Exception, err:
                logging.info('GLASSWARE SUBSCRIBE EXCEPTION: %s' % err)

            logging.info('GLASSWARE SUBSCRIBE RESULT: %s' % result)

        return result

    @webapp2.cached_property
    def mirror_service(self):
        """Will bomb if the credentials don't work."""
        http = httplib2.Http()
        self.credentials.authorize(http)
        mirror_service build('mirror', 'v1', http=http)
        assert mirror_service
        return mirror_service

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


class GlasswareHandler(GlasswareWebRequestHandler):
    @admin_required
    @login_required
    @glass_auth_required
    def get(self):
        result_subscribe = self._insert_subscription()
        self.output_response({
            'title': 'Levels Admin: Tinker',
            'mirror_service': self.mirror_service,
            'result': result_subscribe
        }, 'glassware.html')


class GlasswareNotifyHandler(GlasswareWebRequestHandler):
    def post(self):
        logging.info('GlasswareNotifyHandler with payload %s',
                     self.request.body)
        for user_action in data.get('userActions', []):
            if user_action.get('type') == 'BATTERY':
                logging.info('SWEET, got a battery type timeline')
                # Only handle the first successful action.
                break
            else:
                logging.info('Me no know what to do with this action: %s',
                             user_action)
