#!/usr/bin/python2.4
#
# Copyright 2009 Google Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import datetime
import time

from google.appengine.ext import ndb


# Note we get user from webapp2_extras.
from webapp2_extras.appengine.auth.models import User


# Hack with setattr to add a class method to User.
def get_user_template_data(user):
    template_data = {
      'user': user.to_dict(),
      'devices': []
    }
    q_device = Device.query(ancestor=user.key)
    q_device.order(-Device.created)
    for device in q_device:
        q_settings = Settings.query(ancestor=device.key)
        q_settings.order(-Settings.created)
        last_settings = q_settings.get()
        settings_data = {
          'device': device.to_dict(),
          'settings': last_settings.to_dict()
        }
        template_data['devices'].append(device_data)

    return template_data
setattr(User, 'get_template_data', get_user_template_data)


class Device(ndb.Model):
    created = ndb.DateTimeProperty(auto_now_add=True)
    modified = ndb.DateTimeProperty(auto_now=True)
    uuid = ndb.StringProperty(required=True)
    user_agent_string = ndb.StringProperty()
    update_enabled = ndb.IntegerProperty()
    update_frequency = ndb.IntegerProperty()
    notify_level = ndb.IntegerProperty(default=10)
    is_last_update_over_notify_level = ndb.BooleanProperty(default=True)
    name = ndb.StringProperty()
    platform = ndb.StringProperty()
    version = ndb.StringProperty()


class Settings(ndb.Model):
    created = ndb.DateTimeProperty(auto_now_add=True)
    battery_level = ndb.IntegerProperty(required=True)
    is_charging = ndb.IntegerProperty()


class Following(ndb.Model):
    created = ndb.DateTimeProperty(auto_now_add=True)
    following = ndb.KeyProperty(kind=User)


class Notifying(ndb.Model):
    created = ndb.DateTimeProperty(auto_now_add=True)
    means = ndb.StringProperty(required=True)
    name = ndb.StringProperty()
    type = ndb.StringProperty()


class NotificationSent(ndb.Model):
    created = ndb.DateTimeProperty(auto_now_add=True)
    means = ndb.StringProperty(required=True)


# # Because db.to_dict can't do datetime.datetime, apparently.
# SIMPLE_TYPES = (int, long, float, bool, dict, basestring, list)

# import logging
# def to_dict(model, include_auth_token=False, include_email=False):
#     output = {}

#     if model is None:
#         return output

#     logging.info('include_auth_token: %s' % include_auth_token)
#     for key, prop in model.properties().iteritems():
#         #logging.info('KEY: %s' % key)

#         # Ignore some sensitive fields.
#         if key == 'auth_token' and not include_auth_token:
#             continue
#         if key == 'email' and not include_email:
#             continue

#         value = getattr(model, key)
#         #logging.info('VALUE: %s' % value)

#         if value is None or isinstance(value, SIMPLE_TYPES):
#             output[key] = value
#         elif isinstance(value, datetime.date):
#             # Convert date/datetime to ms-since-epoch ("new Date()").
#             ms = time.mktime(value.utctimetuple())
#             ms += getattr(value, 'microseconds', 0) / 1000
#             output[key] = int(ms)
#         elif isinstance(value, db.GeoPt):
#             output[key] = {'lat': value.lat, 'lon': value.lon}
#         elif isinstance(value, ndb.Model):
#             output[key] = to_dict(value)
#         else:
#             raise ValueError('cannot encode ' + repr(prop))

#     # Ensure we have a model id in our output.
#     if len(model.properties()):
#         if 'id' not in output:
#             output['id'] = str(model.key())

#     return output
