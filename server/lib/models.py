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

from google.appengine.ext import db


class Profile(db.Model):
    created = db.DateTimeProperty(auto_now_add=True)
    modified = db.DateTimeProperty(auto_now=True)
    id = db.StringProperty()
    username = db.StringProperty(required=True)
    auth_token = db.StringProperty()
    email = db.StringProperty()


class Device(db.Model):
    created = db.DateTimeProperty(auto_now_add=True)
    modified = db.DateTimeProperty(auto_now=True)
    uuid = db.StringProperty(required=True)
    user_agent_string = db.StringProperty()
    update_enabled = db.IntegerProperty()
    update_frequency = db.IntegerProperty()
    notify_level = db.IntegerProperty(default=10, required=True)
    is_last_update_over_notify_level = db.BooleanProperty(default=True)
    name = db.StringProperty()
    platform = db.StringProperty()
    version = db.StringProperty()
    # Username fields make the db a little more sane to look at.
    parent_username = db.StringProperty()


class Battery(db.Model):
    created = db.DateTimeProperty(auto_now_add=True)
    level = db.IntegerProperty(required=True)
    is_charging = db.IntegerProperty()


class Following(db.Model):
    created = db.DateTimeProperty(auto_now_add=True)
    following = db.ReferenceProperty(Profile)
    # Username fields make the db a little more sane to look at.
    parent_username = db.StringProperty()
    following_username = db.StringProperty()


class Notifying(db.Model):
    created = db.DateTimeProperty(auto_now_add=True)
    # Username fields make the db a little more sane to look at.
    parent_username = db.StringProperty()
    means = db.StringProperty(required=True)
    name = db.StringProperty()
    type = db.StringProperty()


class NotificationSent(db.Model):
    created = db.DateTimeProperty(auto_now_add=True)
    # Username fields make the db a little more sane to look at.
    parent_username = db.StringProperty()
    means = db.StringProperty(required=True)

# Because db.to_dict can't do datetime.datetime, apparently.
SIMPLE_TYPES = (int, long, float, bool, dict, basestring, list)

import logging
def to_dict(model, include_auth_token=False, include_email=False):
    output = {}
    logging.info('include_auth_token: %s' % include_auth_token)
    for key, prop in model.properties().iteritems():
        #logging.info('KEY: %s' % key)

        # Ignore some sensitive fields.
        if key == 'auth_token' and not include_auth_token:
            continue
        if key == 'email' and not include_email:
            continue

        value = getattr(model, key)
        #logging.info('VALUE: %s' % value)

        if value is None or isinstance(value, SIMPLE_TYPES):
            output[key] = value
        elif isinstance(value, datetime.date):
            # Convert date/datetime to ms-since-epoch ("new Date()").
            ms = time.mktime(value.utctimetuple())
            ms += getattr(value, 'microseconds', 0) / 1000
            output[key] = int(ms)
        elif isinstance(value, db.GeoPt):
            output[key] = {'lat': value.lat, 'lon': value.lon}
        elif isinstance(value, db.Model):
            output[key] = to_dict(value)
        else:
            raise ValueError('cannot encode ' + repr(prop))

    # Ensure we have a model id in our output.
    if len(model.properties()):
        if 'id' not in output:
            output['id'] = str(model.key())

    return output
