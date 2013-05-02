#!/usr/bin/python2.7
#
#

import logging
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), 'external'))


from lib.web_request_handler import WebRequestHandler
from google.appengine.ext import ndb

import webapp2
from webapp2_extras.appengine.auth.models import User

from lib import models

# last import.
import settings


class ProfileHandler(WebRequestHandler):
  def get(self, key=None):
    """Handles GET /profile"""

    if self.logged_in and key is None:
      self.output_response({
        'user': self.current_user,
        'session': self.auth.get_user_by_session()
      }, 'profile.html')

    elif key is not None:
        user_key = ndb.Key(urlsafe=key)
        user = user_key.get()
        logging.info('user: %s', user.to_dict())

        template_data = user.get_template_data()
        template_data.update({
            'session': self.auth.get_user_by_session()
        })
        #template_data['title'] = template_data['profile']['username'] + \
        #    ' ' + str(template_data['devices'][0]['last_settings']['battery_level']) + \
        #    '% - FollowMyBattery'

        self.output_response(template_data, 'profile.html')

    else:
      self.redirect('/login')
