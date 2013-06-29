#!/usr/bin/python2.7
#


import datetime
import json
import logging
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), 'external'))

from lib.web_request_handler import WebRequestHandler
from lib.external.simpleauth import SimpleAuthHandler

from google.appengine.api import users
from google.appengine.ext import ndb
sys.modules['ndb'] = ndb
from google.appengine.datastore.datastore_query import Cursor

import webapp2

from lib import models

# last import.
import settings


class AppHandler(WebRequestHandler):
    def get(self, endpoint=None, more_endpoint=None):
        # TODO(elsigh): cache this baby in memory.
        app_html = open('templates/app.html', 'r').read()
        self.response.out.write(app_html)


class ProfileHandler(WebRequestHandler):
    def get(self, unique_profile_str=None):
        """Handles GET /profile"""

        if unique_profile_str is None:
            self.abort(404)

        # "close" will be set when a user is logging in through the
        # installed Android or iOS app.
        close = self.request.get('close', None)
        user = None

        # If you're logged in ...
        if self.current_user:
            # Maybe it's all about you.
            logging.info('signed in! close: %s' % close)
            if ((self.current_user.unique_profile_str ==
                 unique_profile_str)):
                user = self.current_user

            # If you're not in the OAuth2 login flow in via the mobile app,
            # let's take ya to the web app.
            if close is None:
                if user is not None:
                    logging.info('Looking at yerself.')
                    return self.redirect('/app')
                else:
                    logging.info('Redirect to follow %s' % unique_profile_str)
                    return self.redirect('/app/follow/%s' % unique_profile_str)

        if user is None:
            q = models.FMBUser.query().filter(
                ndb.GenericProperty('unique_profile_str') ==
                unique_profile_str)
            user = q.get()

            if user is None:
                self.abort(404)

        logging.info('Profile user!: %s', user.to_dict())
        template_data = {
            'user': user.to_dict(),
            'user_json': user.to_json(),
            'session': self.auth.get_user_by_session(),
            'close': close,
        }

        # TODO(elsigh): Allow user to set "default" device or
        # sort order devices one day.
        template_data['title'] = template_data['user']['name']
        if (('devices' in template_data['user'] and
             len(template_data['user']['devices']))):
            first_device = template_data['user']['devices'][0]
            if (('settings' in first_device and
                 len(first_device['settings']))):
                most_recent_setting = first_device['settings'][0]
                template_data['title'] += (
                    ' - ' +
                    str(most_recent_setting['battery_level']) + '%')

        template_data['title'] += ' - Levels'

        self.output_response(template_data, 'profile.html')


class SupportHandler(WebRequestHandler):
    def get(self):
        self.output_response({
            'title': 'Levels - Support'
        }, 'support.html')


class IndexHandler(WebRequestHandler):
    def get(self):
        self.output_response({
            'title': 'Levels App'
        }, 'index.html')
