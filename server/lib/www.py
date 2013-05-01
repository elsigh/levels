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

class OtherProfileHandler(WebRequestHandler):
    """Looks up by username and display battery info."""
    def get(self, user_id=None):
        logging.info('UserRequestHandler %s' % user_id)

        if user_id is None or user_id == '':
            return self.output_response({}, 'index.html')

        #user_key = ndb.Key('User', user_id)
        #user = user_key.get()
        user = User.get_by_id(user_id)
        logging.info('user: %s', user)

        self.output_response({
            'user': user,
            'session': {}
        }, 'profile.html')


        # q = db.Query(models.Profile).filter('username =', username)
        # if q.count() == 0:
        #     self.abort(404)
        # profile = q.get()
        # template_data = {
        #   'profile': models.to_dict(profile),
        #   'devices': []
        # }
        # q_device = db.Query(models.Device)
        # q_device.ancestor(profile.key())
        # q_device.order('-created')

        # for device in q_device:
        #     q_settings = db.Query(models.Settings)
        #     q_settings.ancestor(device.key())
        #     q_settings.order('-created')
        #     last_settings = q_settings.get()
        #     settings_data = {
        #       'device': models.to_dict(device),
        #       'settings': models.to_dict(last_settings)
        #     }
        #     template_data['devices'].append(device_data)

        # template_data['title'] = template_data['profile']['username'] + \
        #     ' ' + str(template_data['devices'][0]['last_settings']['battery_level']) + \
        #     '% - FollowMyBattery'

        # logging.info('TPL_DATA %s' % template_data)
        # self.output_response(template_data, 'battery_status.html')


class ProfileHandler(WebRequestHandler):
  def get(self):
    """Handles GET /profile"""
    if self.logged_in:
      self.output_response({
        'user': self.current_user,
        'session': self.auth.get_user_by_session()
      }, 'profile.html')
    else:
      self.redirect('/login')
