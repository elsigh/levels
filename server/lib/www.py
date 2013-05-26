#!/usr/bin/python2.7
#
#

import datetime
import json
import logging
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), 'external'))


from lib.web_request_handler import WebRequestHandler
from google.appengine.ext import ndb

import webapp2

from lib import models

# last import.
import settings


class ProfileHandler(WebRequestHandler):
    def get(self, user_key=None):
        """Handles GET /profile"""

        close = self.request.get('close')

        if self.current_user and user_key is None:
          user = self.current_user
        elif user_key is not None:
            try:
                user = ndb.Key(urlsafe=user_key).get()
            except:
                user = models.FMBUser()

        logging.info('Profile user!: %s', user.to_dict())
        template_data = {
            'user': user.to_dict(),
            'user_json': user.to_json(),
            'session': self.auth.get_user_by_session(),
            'close': close,
        }

        # TODO(elsigh): Allow user to set "default" device or order devices one day.
        template_data['title'] = template_data['user']['name']
        if 'devices' in template_data['user'] and len(template_data['user']['devices']):
            if ('settings' in template_data['user']['devices'][0] and
                len(template_data['user']['devices'][0]['settings'])):
                template_data['title'] += str(template_data['user']['devices'][0]['settings']['battery_level']) + '%'

        template_data['title'] += ' - Levels'

        self.output_response(template_data, 'profile.html')


class IndexHandler(WebRequestHandler):
  def get(self):
    return self.redirect(
        '/profile/ahNkZXZ-Zm9sbG93bXliYXR0ZXJ5cg8LEgdGTUJVc2VyGLmUAQw')
