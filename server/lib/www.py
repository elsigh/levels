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

    template_data = {
        'user': user.to_dict(),
        'user_json': user.to_json(),
        'session': self.auth.get_user_by_session(),
        'close': close,
    }
    #template_data['title'] = template_data['profile']['username'] + \
    #    ' ' + str(template_data['devices'][0]['last_settings']['battery_level']) + \
    #    '% - FollowMyBattery'

    self.output_response(template_data, 'profile.html')
