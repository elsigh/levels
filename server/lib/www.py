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
sys.modules['ndb'] = ndb

import webapp2

from webapp2_extras.appengine.users import admin_required

from lib import models

# last import.
import settings



class AdminUserMessageTestHandler(WebRequestHandler):
    @admin_required
    def get(self):
        self.output_response({'result': 'not yet'}, 'admin_user_message_test.html')

    def post(self):
        user_id = self.request.get('user_id')
        message = self.request.get('message', 'Test message')
        result = False
        if user_id:
            user = models.FMBUser.get_by_id(int(user_id))
            if user:
                result = user.send_message(message)
        self.output_response({'result': result}, 'admin_user_message_test.html')


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
                template_data['title'] += (
                    ' - ' +
                    str(template_data['user']['devices'][0]['settings'][0]['battery_level']) +
                    '%')

        template_data['title'] += ' - Levels'

        self.output_response(template_data, 'profile.html')


class IndexHandler(WebRequestHandler):
  def get(self):
    if self.is_production:
        elsigh_key = 'ahFzfmZvbGxvd215YmF0dGVyeXIPCxIHRk1CVXNlchi5lAEM'
    else:
        elsigh_key = 'ahNkZXZ-Zm9sbG93bXliYXR0ZXJ5cg8LEgdGTUJVc2VyGLmUAQw'
    return self.redirect('/profile/%s' % elsigh_key)
