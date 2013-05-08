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
import sys
import time

from google.appengine.ext import ndb
sys.modules['ndb'] = ndb

from webapp2_extras.appengine.auth.models import User


class FMBModel(ndb.Model):
    def to_dict(self):
        obj = super(FMBModel, self).to_dict()
        obj['id'] = self.key.id()
        urlsafe_key = self.key.urlsafe()
        obj['key'] = urlsafe_key
        return obj


class FMBUser(User, FMBModel):
    def get_template_data(self):
        template_data = {
          'user': self.to_dict(),
          'devices': []
        }
        q_device = Device.query(ancestor=self.key)
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


class Device(FMBModel):
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


class Settings(FMBModel):
    created = ndb.DateTimeProperty(auto_now_add=True)
    battery_level = ndb.IntegerProperty(required=True)
    is_charging = ndb.IntegerProperty()


class Following(FMBModel):
    created = ndb.DateTimeProperty(auto_now_add=True)
    following = ndb.KeyProperty(kind=User)


class Notifying(FMBModel):
    created = ndb.DateTimeProperty(auto_now_add=True)
    means = ndb.StringProperty(required=True)
    name = ndb.StringProperty()
    type = ndb.StringProperty()


class NotificationSent(FMBModel):
    created = ndb.DateTimeProperty(auto_now_add=True)
    means = ndb.StringProperty(required=True)

