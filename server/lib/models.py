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
import logging
import sys
import time
import uuid

try:
    import json
except:
    import simplejson

from google.appengine.api import mail
from google.appengine.api import memcache
from google.appengine.ext import ndb
sys.modules['ndb'] = ndb

from webapp2_extras.appengine.auth.models import User

from lib.external import general_counter
from lib.external.gae_python_gcm import gcm

import settings


NUM_SETTINGS_TO_FETCH = 10
NUM_SETTINGS_MULTIPLIER = 10
DEFAULT_AVATAR_URL = ('http://lh3.googleusercontent.com/-XdUIqdMkCWA/'
                      'AAAAAAAAAAI/AAAAAAAAAAA/4252rscbv5M/s96/photo.jpg')


class FMBModel(ndb.Model):

    @classmethod
    def json_dump(cls, obj):
        date_handler = (lambda obj: obj.isoformat()
                        if isinstance(obj, datetime.datetime) else None)
        return json.dumps(obj, default=date_handler)

    @property
    def counters(self):
        return []

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

        for counter in self.counters:
            obj[counter] = self.get_count(counter)

        return obj

    def get_counter_name(self, name):
        return '%s-%s' % (name, self.key.urlsafe())

    def get_count(self, name):
        counter_name = self.get_counter_name(name)
        return general_counter.get_count(counter_name)

    def increment_count(self, name):
        counter_name = self.get_counter_name(name)
        general_counter.increment(counter_name)


class FMBUser(User, FMBModel):
    def _pre_put_hook(self):
        if not hasattr(self, 'api_token'):
            self.api_token = str(uuid.uuid4())

        if not hasattr(self, 'allow_phone_lookup'):
            self.allow_phone_lookup = False

        if not hasattr(self, 'allow_gmail_lookup'):
            self.allow_gmail_lookup = True

        if not hasattr(self, 'unique_profile_str'):
            if ((hasattr(self, 'email') and
                 self.is_gmail_account and
                 self.allow_gmail_lookup)):
                self.unique_profile_str = self.gmail_username
            else:
                self.unique_profile_str = str(uuid.uuid4())[:8]

        # i.e. user doesn't want people to look them up by gmail name.
        elif (self.is_gmail_account and
              self.unique_profile_str == self.gmail_username and
              not self.allow_gmail_lookup):
            self.unique_profile_str = str(uuid.uuid4())[:8]

        # i.e. user does want people to look them up by gmail name.
        elif (self.is_gmail_account and
              self.unique_profile_str != self.gmail_username and
              self.allow_gmail_lookup):
            self.unique_profile_str = self.gmail_username

        #logging.info('POST _pre_put_hook %s' % self)

    @property
    def is_gmail_account(self):
        return hasattr(self, 'email') and self.email.find('@gmail.com') != -1

    @property
    def gmail_username(self):
        return self.email.replace('@gmail.com', '')

    @property
    def iter_devices(self):
        q = Device.query(ancestor=self.key).order(-Device.created)
        return q.fetch()

    def to_dict(self, include_api_token=False, include_device_notifying=False):
        obj = super(FMBUser, self).to_dict(include_api_token=include_api_token)

        # Default avatar url
        if (('avatar_url' not in obj or
             obj['avatar_url'] == '' or
             obj['avatar_url'] is None)):
            obj.update({
                'avatar_url': DEFAULT_AVATAR_URL
            })

        obj['devices'] = []
        for device in self.iter_devices:
            obj['devices'].append(
                device.to_dict(include_notifying=include_device_notifying))

        return obj

    def get_profile_url(self):
        return 'www.levelsapp.com/p/%s' % self.unique_profile_str

    def send_message(self, message, extra={}):
        """Tries a few different means/methods to send a message to a user."""
        logging.info('FMBUser %s send_message %s, extra: %s' %
                     (self.name, message, extra))

        if hasattr(self, 'email'):
            mail.send_mail(
                sender=settings.MAIL_FROM,
                to='%s <%s>' % (self.name, self.email),
                subject='[Levels] A message for you',
                body=message)
            logging.info('Sending email to user.')

        for device in self.iter_devices:
            if hasattr(device, 'gcm_push_token'):
                push_token = device.gcm_push_token
                android_payload = {
                    'message': message
                }
                android_payload.update(extra)
                gcm_message = gcm.GCMMessage(push_token, android_payload)
                gcm_conn = gcm.GCMConnection()
                logging.info('Send android_payload %s to push_token %s.' %
                             (repr(android_payload), repr(push_token)))
                gcm_conn.notify_device(gcm_message)


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
    gcm_push_token = ndb.StringProperty()
    app_version = ndb.IntegerProperty()

    @property
    def immutable_update_properties(self):
        """Returns a list of properties that POST can't modify."""
        return ['created', 'modified', 'uuid',
                'is_last_update_over_notify_level']

    @property
    def counters(self):
        return ['settings_received_count', 'send_battery_notifications_count']

    def to_dict(self, include_notifying=True):
        obj = super(Device, self).to_dict()

        # device settings - cached for 60 seconds.
        memcache_device_settings_key = 'settings-%s' % self.key.urlsafe()
        settings = memcache.get(memcache_device_settings_key)
        if not settings:
            settings = []
            q_settings = Settings.query(
                ancestor=self.key).order(-Settings.created)
            results = q_settings.fetch(
                NUM_SETTINGS_TO_FETCH * NUM_SETTINGS_MULTIPLIER,
                keys_only=True)
            list_of_keys = []
            # prunes the results so we get a longer time-window picture of
            # the device's battery stats.
            for i in range(len(results)):
                if i % NUM_SETTINGS_MULTIPLIER == 0:
                    list_of_keys.append(results[i])
            for setting in ndb.get_multi(list_of_keys):
                settings.append(setting.to_dict())
            memcache.set(memcache_device_settings_key, settings)
        obj['settings'] = settings

        # notifying
        logging.info('Device %s to dict include_notifying: %s' %
                     (self.key.id(), include_notifying))

        if include_notifying:
            q_notifying = Notifying.query(
                ancestor=self.key).order(-Notifying.created)
            logging.info('.. notifying len: %s' % q_notifying.count())
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
    cid = ndb.StringProperty()
    following = ndb.KeyProperty(kind=FMBUser)


class Notifying(FMBModel):
    created = ndb.DateTimeProperty(auto_now_add=True)
    means = ndb.StringProperty(required=True)
    cid = ndb.StringProperty()
    name = ndb.StringProperty()
    type = ndb.StringProperty()


class NotificationSent(FMBModel):
    created = ndb.DateTimeProperty(auto_now_add=True)
    means = ndb.StringProperty(required=True)
