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
from lib.external.apiclient import discovery
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
                # Has to be a fully qualified HTTPS resource.
                'callbackUrl': ('https://followmybattery.appspot.com/'
                                'glassware/notify')
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
        mirror_service = discovery.build('mirror', 'v1', http=http)
        # TODO(elsigh): Figure out incremental scopes and re-auth here if
        # necessary.
        assert mirror_service
        return mirror_service

    @property
    def credentials(self):
        u = self.current_user
        if u is None:
            u = self._current_user
            logging.info('Using private _current_user for credentials')
        return OAuth2Credentials(
            u.oauth2_access_token,
            settings.GOOGLE_APP_ID,
            settings.GOOGLE_APP_SECRET,
            u.oauth2_refresh_token,
            u.oauth2_expires_datetime,
            token_uri='https://accounts.google.com/o/oauth2/token',
            user_agent=settings.USER_AGENT)


class GlasswareHandler(GlasswareWebRequestHandler):
    @login_required
    def get(self):
        result_subscribe = self._insert_subscription()
        self.output_response({
            'title': 'Levels: Glassware',
            'mirror_service': self.mirror_service,
            'result': result_subscribe
        }, 'glassware.html')


class GlasswareNotifyHandler(GlasswareWebRequestHandler):
    def update_glass_battery_status(self, battery_status):
        # first see if the user has a glass and if not make one.
        # TODO(elsigh): figure out getting uuid for a glass.
        glass_uuid = 'glass'
        glass_device = models.Device.query(
            ancestor=self._current_user.key).filter(
                models.Device.uuid == glass_uuid).get()

        if glass_device is None:
            glass_device = models.Device(
                uuid=glass_uuid,
                parent=self._current_user.key)
            glass_device.put()

        settings = models.Settings(
            parent=glass_device.key
        )

        settings_data = {
            'created': battery_status['created'],
            'battery_level': int(battery_status['capacity']),
            'is_charging': battery_status['is_charging']
        }
        settings.populate(**settings_data)
        settings.put()

    def post(self):
        logging.info('GlasswareNotifyHandler with payload %s',
                     self.request.body)
        data = json.loads(self.request.body)
        user_id = data['userToken']
        self._current_user = models.FMBUser.query().filter(
            ndb.GenericProperty('auth_ids').IN(
                ['google:%s' % user_id])).get()
        logging.info('Glassware _current_user: %s', self._current_user)

        battery_status = None
        for user_action in data.get('userActions', []):
            if user_action.get('type') == 'SHARE':
                # Fetch the timeline item.
                item = self.mirror_service.timeline().get(
                    id=data['itemId']).execute()
                logging.info('SWEET, got a battery item in timeline %s',
                             item)
                # Only handle the first successful action.
                battery_status = json.loads(item['text'])
                battery_status['created'] = item['created']
                break
            else:
                logging.info('Me no know what do with action: %s', user_action)

        if battery_status is not None:
            self.update_glass_battery_status(battery_status)

        # Happy API response.
        self.response.out.write('AOK =)')
