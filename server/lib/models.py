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
import uuid

try:
    import json
except:
    import simplejson

from google.appengine.ext import ndb
sys.modules['ndb'] = ndb

from webapp2_extras.appengine.auth.models import User


class FMBModel(ndb.Model):

    @classmethod
    def json_dump(cls, obj):
        date_handler = lambda obj: obj.isoformat() if isinstance(obj, datetime.datetime) else None
        return json.dumps(obj, default=date_handler)

    def to_json(self):
        return FMBModel.json_dump(self.to_dict())

    def to_dict(self, include_api_token=False):
        obj = super(FMBModel, self).to_dict()
        urlsafe_key = self.key.urlsafe()
        #obj['id'] = urlsafe_key
        obj['key'] = urlsafe_key

        if 'api_token' in obj and not include_api_token:
            obj.pop('api_token')
        if 'password' in obj:
            obj.pop('password')

        return obj


class FMBUser(User, FMBModel):
    def _pre_put_hook(self):
        if not hasattr(self, 'api_token'):
            self.api_token = str(uuid.uuid4())

    def to_dict(self, include_api_token=False, include_device_notifying=False):
        obj = super(FMBUser, self).to_dict(include_api_token=include_api_token)
        obj['devices'] = []
        q_device = Device.query(ancestor=self.key)
        q_device = q_device.order(-Device.created)
        for device in q_device:
            obj['devices'].append(device.to_dict(include_notifying=include_device_notifying))
        return obj


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

    def to_dict(self, include_notifying=True):
        NUM_SETTINGS_TO_FETCH = 10
        obj = super(Device, self).to_dict()

        # settings
        q_settings = Settings.query(ancestor=self.key).order(-Settings.created)
        obj['settings'] = []
        for setting in q_settings.fetch(NUM_SETTINGS_TO_FETCH):
            obj['settings'].append(setting.to_dict())

        # notifying
        if include_notifying:
            q_notifying = Notifying.query(ancestor=self.key).order(-Notifying.created)
            obj['notifying'] = []
            for notifying in q_notifying:
                obj['notifying'].append(notifying.to_dict())

        return obj


class Settings(FMBModel, ndb.Expando):
    created = ndb.DateTimeProperty(auto_now_add=True)
    battery_level = ndb.IntegerProperty(required=True)
    is_charging = ndb.IntegerProperty()


class Following(FMBModel):
    created = ndb.DateTimeProperty(auto_now_add=True)
    following = ndb.KeyProperty(kind=FMBUser)


class Notifying(FMBModel):
    created = ndb.DateTimeProperty(auto_now_add=True)
    means = ndb.StringProperty(required=True)
    name = ndb.StringProperty()
    type = ndb.StringProperty()


class NotificationSent(FMBModel):
    created = ndb.DateTimeProperty(auto_now_add=True)
    means = ndb.StringProperty(required=True)

