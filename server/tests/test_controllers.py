#!/usr/bin/python2.7
#
#

import base64
import datetime
import json
import os
import sys

from mock import patch
from mock import call

# Need the server root dir on the path.
sys.path.append(os.path.dirname(os.path.abspath(__file__)) + '/..')

import logging

from google.appengine.api import mail
from google.appengine.api import memcache
from google.appengine.ext import ndb
from google.appengine.ext import testbed

import unittest
import webtest

from lib.external.apiclient import discovery
#from lib.external.apiclient.discovery import build
from lib.external.gae_python_gcm import gcm
from lib.web_request_handler import WebRequestHandler
from lib import api
from lib import controllers
from lib import models

import settings


class FMBUserTest(unittest.TestCase):
    def testPrePutHook(self):
        user = models.FMBUser()
        user.put()
        print user
        assert user.api_token
        assert user.unique_profile_str
        assert user.name is not None
        assert user.given_name is not None
        assert user.family_name is not None


class HandlerTest(unittest.TestCase):
    def setUp(self):
        self.testbed = testbed.Testbed()
        self.testbed.setup_env(app_id='followmybattery')
        self.testbed.activate()
        self.testbed.init_datastore_v3_stub()
        self.testbed.init_taskqueue_stub()
        self.taskqueue_stub = self.testbed.get_stub(testbed.TASKQUEUE_SERVICE_NAME)
        self.testapp = webtest.TestApp(controllers.app)

    def tearDown(self):
        self.testbed.deactivate()

    def test_WWW(self):
        response = self.testapp.get('/', status=200)
        response = self.testapp.get('/support', status=200)
        response = self.testapp.get('/app', status=200)

        elsigh_user = models.FMBUser(
            name='elsigh'
        )
        elsigh_user.put()
        response = self.testapp.get(
            '/p/%s' % elsigh_user.unique_profile_str, status=200)
        assert response.normal_body

    def test_DeviceModel_to_dict(self):
        device = models.Device(uuid='test_uuid')
        device.put()

        for i in range(models.NUM_SETTINGS_TO_FETCH * models.NUM_SETTINGS_MULTIPLIER):
            battery_level = 50 + i
            settings_model = models.Settings(
                parent=device.key,
                battery_level=battery_level
            )
            settings_model.put()
        data = device.to_dict()
        assert 'settings' in data
        assert len(data['settings']) == models.NUM_SETTINGS_TO_FETCH

    def test_ApiUserHandler_get(self):
        self.testapp.get('/api/user', status=500)

        elsigh_user = models.FMBUser(
            name='elsigh'
        )
        elsigh_user.put()

        # Without an api_token, we should bomb.
        response = self.testapp.get('/api/user',
                                    params=dict(user_key=elsigh_user.key.urlsafe()),
                                    status=500)

        response = self.testapp.get('/api/user',
                                    params=dict(api_token=elsigh_user.api_token,
                                                user_key=elsigh_user.key.urlsafe()),
                                    headers={'Origin': 'foo'})

        # Test CORS origin header.
        cors_headers = [
            'Access-Control-Allow-Origin',
            'Access-Control-Allow-Methods',
            'Access-Control-Allow-Credentials',
            'Access-Control-Allow-Headers'
        ]
        for header in cors_headers:
            self.assertTrue(header in response.headers.keys())

        self.assertEquals('foo',
                          response.headers.get('Access-Control-Allow-Origin'))

        # Basic user response.
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(elsigh_user.key.urlsafe(), obj['key'])

    def test_ApiUserHandler_post(self):
        elsigh_user = models.FMBUser(
            name='elsigh',
            email='elsigh@gmail.com'
        )
        elsigh_user.put()

        self.assertTrue(elsigh_user.is_gmail_account)

        self.assertEquals(True, elsigh_user.allow_gmail_lookup)
        self.assertEquals('elsigh', elsigh_user.unique_profile_str)

        response = self.testapp.post_json('/api/user',
                                          params=dict(api_token=elsigh_user.api_token,
                                                      user_key=elsigh_user.key.urlsafe(),
                                                      app_version=30,
                                                      allow_phone_lookup=True,
                                                      allow_gmail_lookup=False))

        body = response.normal_body
        obj = json.loads(body)

        self.assertNotEquals('elsigh', obj['unique_profile_str'])
        self.assertFalse(obj['allow_gmail_lookup'])
        self.assertTrue(obj['allow_phone_lookup'])
        self.assertEquals(30, obj['app_version'])

        # toggle allow_gmail_lookup
        response = self.testapp.post_json('/api/user',
                                          params=dict(api_token=elsigh_user.api_token,
                                                      user_key=elsigh_user.key.urlsafe(),
                                                      allow_gmail_lookup=True))

        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals('elsigh', obj['unique_profile_str'])

        # toggle allow_gmail_lookup
        response = self.testapp.post_json('/api/user',
                                          params=dict(api_token=elsigh_user.api_token,
                                                      user_key=elsigh_user.key.urlsafe(),
                                                      allow_gmail_lookup=False))
        body = response.normal_body
        obj = json.loads(body)
        self.assertNotEquals('elsigh', obj['unique_profile_str'])

    def test_ApiUserTokenHandler(self):
        elsigh_user = models.FMBUser(
            name='elsigh'
        )
        elsigh_user.put()

        # tests the _pre_put_hook
        assert elsigh_user.api_token is not None

        user_token = 'foobar'
        memcache.add('user_token-%s' % user_token, elsigh_user.key.id())
        # Additionally here, testing that a string for app_version gets
        # converted by our server to an integer.
        response = self.testapp.post_json('/api/user/token',
                                          params=dict(user_token=user_token,
                                                      app_version='30'))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(elsigh_user.name, obj['name'])
        self.assertEquals(30, obj['app_version'])

        self.assertEquals(elsigh_user.api_token, obj['api_token'])

        should_be_none = memcache.get('user_token-%s' % user_token)
        assert should_be_none is None

    def test_ApiDeviceHandler_create(self):
        elsigh_user = models.FMBUser(
            name='elsigh'
        )
        elsigh_user.put()

        # Without a user_id, we should bomb.
        response = self.testapp.post_json('/api/device',
                                          params=dict(uuid='test_device_uuid',
                                                      user_agent_string='ua'),
                                          status=500)

        # Without a *matching* user_key, we should bomb.
        response = self.testapp.post_json('/api/device',
                                          params=dict(user_key='NOMATCH',
                                                      uuid='test_device_uuid',
                                                      user_agent_string='ua'),
                                          status=500)

        # Without a real user_key + API key, we should bomb.
        response = self.testapp.post_json('/api/device',
                                          params=dict(user_key=elsigh_user.key.urlsafe(),
                                                      uuid='test_device_uuid',
                                                      user_agent_string='ua'),
                                          status=500)

        # Create a device associated with that user.
        response = self.testapp.post_json('/api/device',
                                          params=dict(api_token=elsigh_user.api_token,
                                                      user_key=elsigh_user.key.urlsafe(),
                                                      uuid='test_device_uuid',
                                                      user_agent_string='ua',
                                                      update_enabled='1',
                                                      update_frequency='20',
                                                      name='Samsung',
                                                      platform='Android',
                                                      version='S3',
                                                      app_version='29'))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(1, obj['update_enabled'])
        self.assertEquals(29, obj['app_version'])

        # Test an ancestor query to ensure all our relationships are setup.
        q = models.Device.query(ancestor=elsigh_user.key)
        self.assertEquals(1, q.count())
        query_device = q.get()
        self.assertEquals('test_device_uuid', query_device.uuid)

    def test_ApiDeviceHandler_update(self):
        elsigh_user = models.FMBUser(
            name='elsigh'
        )
        elsigh_user.put()

        elsigh_device = models.Device(
            uuid='test_device_uuid',
            parent=elsigh_user.key,
            notify_level=10
        )
        elsigh_device.put()

        # Tests an update to that device.
        response = self.testapp.post_json('/api/device',
                                          params=dict(api_token=elsigh_user.api_token,
                                                      user_key=elsigh_user.key.urlsafe(),
                                                      uuid=elsigh_device.uuid,
                                                      user_agent_string='ua',
                                                      name='Samsung',
                                                      platform='Android',
                                                      version='S3'))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals('Samsung', obj['name'])
        self.assertEquals('S3', obj['version'])

        # Tests another update to that device.
        response = self.testapp.post_json('/api/device',
                                          params=dict(api_token=elsigh_user.api_token,
                                                      user_key=elsigh_user.key.urlsafe(),
                                                      uuid=elsigh_device.uuid,
                                                      gcm_push_token='test_gcm_push_token'))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals('test_gcm_push_token', obj['gcm_push_token'])

    def test_ApiUserGCMPushTokenHandler_get(self):
        elsigh_user = models.FMBUser(
            name='elsigh'
        )
        elsigh_user.put()

        elsigh_device = models.Device(
            uuid='elsigh_uuid',
            parent=elsigh_user.key
        )
        elsigh_device.put()

        response = self.testapp.post_json('/api/user/gcm_push_token',
                                          params=dict(api_token=elsigh_user.api_token,
                                                      user_key=elsigh_user.key.urlsafe(),
                                                      gcm_push_token='test_gcm_push_token'))
        q_device = models.Device.query(ancestor=elsigh_user.key)
        q_device = q_device.order(-models.Device.created)
        device = q_device.get()  # Aka most users only have 1 device.
        self.assertEquals('test_gcm_push_token', device.gcm_push_token)

    def test_ApiDeviceDeleteHandler(self):
        elsigh_user = models.FMBUser(
            name='elsigh'
        )
        elsigh_user.put()

        elsigh_device = models.Device(
            uuid='test_device_uuid',
            parent=elsigh_user.key,
            notify_level=10
        )
        elsigh_device.put()

        elsigh_device2 = models.Device(
            uuid='test_device_uuid2',
            parent=elsigh_user.key,
            notify_level=10
        )
        elsigh_device2.put()

        q = models.Device.query(ancestor=elsigh_user.key)
        self.assertEquals(2, q.count())

        response = self.testapp.post_json('/api/device/delete',
                                          params=dict(api_token=elsigh_user.api_token,
                                                      user_key=elsigh_user.key.urlsafe(),
                                                      device_key=elsigh_device.key.urlsafe(),
                                                      key=elsigh_device2.key.urlsafe()))

        q = models.Device.query(ancestor=elsigh_user.key)
        self.assertEquals(1, q.count())

    def test_ApiSettingsHandler(self):
        elsigh_user = models.FMBUser(
            name='elsigh'
        )
        elsigh_user.put()

        elsigh_device = models.Device(
            uuid='test_device_uuid',
            parent=elsigh_user.key,
            notify_level=10
        )
        elsigh_device.put()

        response = self.testapp.post_json('/api/settings',
                                          params=dict(api_token=elsigh_user.api_token,
                                                      user_key=elsigh_user.key.urlsafe(),
                                                      device_key=elsigh_device.key.urlsafe(),
                                                      battery_level=82,
                                                      is_charging=0,
                                                      expando_test=1))

        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(82, obj['battery_level'])
        self.assertEquals(1, obj['expando_test'])
        assert not 'api_token' in obj
        self.assertTrue(obj['is_last_update_over_notify_level'])

        # tests that a settings entity made it to the datastore.
        q_settings = models.Settings.query(ancestor=elsigh_device.key)
        self.assertEquals(1, q_settings.count())

        # tests that our counter updated
        self.assertEquals(1, elsigh_device.get_count('settings_received_count'))

        # no tasks because we didn't kick off notifications.
        tasks = self.taskqueue_stub.GetTasks('default')
        self.assertEqual(0, len(tasks))

        response = self.testapp.post_json('/api/settings',
                                          params=dict(api_token=elsigh_user.api_token,
                                                      user_key=elsigh_user.key.urlsafe(),
                                                      device_key=elsigh_device.key.urlsafe(),
                                                      battery_level=9,
                                                      is_charging=0))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(9, obj['battery_level'])
        self.assertFalse(obj['is_last_update_over_notify_level'])

        # tests that our counter updated
        self.assertEquals(2, elsigh_device.get_count('settings_received_count'))

        # now we should have kicked off a notification.
        tasks = self.taskqueue_stub.GetTasks('default')
        self.assertEqual(1, len(tasks))

        response = self.testapp.post_json('/api/settings',
                                          params=dict(api_token=elsigh_user.api_token,
                                                      user_key=elsigh_user.key.urlsafe(),
                                                      device_key=elsigh_device.key.urlsafe(),
                                                      battery_level=11,
                                                      is_charging=0))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(11, obj['battery_level'])
        self.assertTrue(obj['is_last_update_over_notify_level'])

        # tests that our counter updated
        self.assertEquals(3, elsigh_device.get_count('settings_received_count'))

    def test_ApiFollowingHandler(self):
        elsigh_user = models.FMBUser(
            name='elsigh'
        )
        elsigh_user.put()

        jr_user = models.FMBUser(
            id='jr_user_id',
            name='jr'
        )
        jr_user.put()

        jr_device = models.Device(
            uuid='jr_uuid',
            parent=jr_user.key
        )
        jr_device.put()

        jr_settings = models.Settings(
            parent=jr_device.key,
            battery_level=75,
            is_charging=1
        )
        jr_settings.put()

        jr_following = models.Following(
            following=jr_user.key,
            parent=elsigh_user.key
        )
        jr_following.put()

        ded_user = models.FMBUser(
            id='ded_user_id',
            name='ded'
        )
        ded_user.put()

        ded_device = models.Device(
            uuid='ded_uuid',
            parent=ded_user.key
        )
        ded_device.put()

        ded_settings = models.Settings(
            parent=ded_device.key,
            battery_level=35,
            is_charging=0
        )
        ded_settings.put()

        ded_following = models.Following(
            following=ded_user.key,
            parent=elsigh_user.key
        )
        ded_following.put()

        # Gut check on the ancestor query thing.
        q = models.Following.query(ancestor=elsigh_user.key)
        self.assertEquals(2, q.count())

        response = self.testapp.get('/api/following',
                                    params=dict(api_token=elsigh_user.api_token,
                                                user_key=elsigh_user.key.urlsafe()))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(2, len(obj['following']))

    def test_ApiFollowingHandler_add_by_key(self):
        elsigh_user = models.FMBUser(
            name='elsigh'
        )
        elsigh_user.put()

        ded_user = models.FMBUser(
            name='ded'
        )
        ded_user.put()
        response = self.testapp.post_json('/api/following',
                                          params=dict(api_token=elsigh_user.api_token,
                                                      user_key=elsigh_user.key.urlsafe(),
                                                      following_user_key=ded_user.key.urlsafe(),
                                                      cid='test_cid'))

        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals('ded', obj['name'])
        self.assertEquals('test_cid', obj['cid'])

        q = models.Following.query(ancestor=elsigh_user.key)
        q = q.filter(models.Following.following == ded_user.key)
        assert 1 == q.count()

        # Trying to follow ded again should error.
        response = self.testapp.post_json('/api/following',
                                          params=dict(api_token=elsigh_user.api_token,
                                                      user_key=elsigh_user.key.urlsafe(),
                                                      following_user_key=ded_user.key.urlsafe(),
                                                      cid='test_cid_2'),
                                          status=409)
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals('exists', obj['error'])

    def test_ApiFollowingHandler_add_by_unique_profile_str(self):
        elsigh_user = models.FMBUser(
            name='elsigh'
        )
        elsigh_user.put()

        ded_user = models.FMBUser(
            name='ded'
        )
        ded_user.put()
        response = self.testapp.post_json('/api/following',
                                          params=dict(api_token=elsigh_user.api_token,
                                                      user_key=elsigh_user.key.urlsafe(),
                                                      following_user_unique_profile_str=ded_user.unique_profile_str,
                                                      cid='test_cid'))

        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals('ded', obj['name'])
        self.assertEquals('test_cid', obj['cid'])

        q = models.Following.query(ancestor=elsigh_user.key)
        q = q.filter(models.Following.following == ded_user.key)
        assert 1 == q.count()

    def test_ApiFollowingHandler_delete(self):
        elsigh_user = models.FMBUser(
            name='elsigh'
        )
        elsigh_user.put()

        ded_user = models.FMBUser(
            name='ded'
        )
        ded_user.put()

        following = models.Following(
            parent=elsigh_user.key,
            following=ded_user.key
        )
        following.put()

        q = models.Following.query(ancestor=elsigh_user.key)
        self.assertEquals(1, q.count())

        response = self.testapp.post_json('/api/following/delete',
                                          params=dict(api_token=elsigh_user.api_token,
                                                      user_key=elsigh_user.key.urlsafe(),
                                                      key=ded_user.key.urlsafe()))

        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals('ded', obj['name'])

        q = models.Following.query(ancestor=elsigh_user.key)
        self.assertEquals(0, q.count())

        # Trying to delete ded again should error.
        self.testapp.post_json('/api/following/delete',
                               params=dict(api_token=elsigh_user.api_token,
                                           user_key=elsigh_user.key.urlsafe(),
                                           key=ded_user.key.urlsafe()),
                               status=404)

    def test_ApiNotifyingHandler_get(self):
        elsigh_user = models.FMBUser(
            name='elsigh'
        )
        elsigh_user.put()

        elsigh_device = models.Device(
            uuid='elsigh_uuid',
            parent=elsigh_user.key
        )
        elsigh_device.put()

        ded_notifying = models.Notifying(
            parent=elsigh_device.key,
            means='4152223333',
            name='Dustin Diaz',
            type='phone'
        )
        ded_notifying.put()

        jr_notifying = models.Notifying(
            parent=elsigh_device.key,
            means='4158889999',
            name='John Forsythe',
            type='phone'
        )
        jr_notifying.put()

        # Gut check on the ancestor query thing.
        q = models.Notifying.query(ancestor=elsigh_device.key)
        self.assertEquals(2, q.count())

        response = self.testapp.get('/api/notifying',
                                    params=dict(api_token=elsigh_user.api_token,
                                                user_key=elsigh_user.key.urlsafe(),
                                                device_key=elsigh_device.key.urlsafe()))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(2, len(obj['notifying']))

    def test_ApiNotifyingHandler_add(self):
        elsigh_user = models.FMBUser(
            name='elsigh'
        )
        elsigh_user.put()

        elsigh_device = models.Device(
            uuid='elsigh_uuid',
            parent=elsigh_user.key
        )
        elsigh_device.put()

        tasks = self.taskqueue_stub.GetTasks('default')
        self.assertEqual(0, len(tasks))

        response = self.testapp.post_json('/api/notifying',
                                          params=dict(api_token=elsigh_user.api_token,
                                                      user_key=elsigh_user.key.urlsafe(),
                                                      device_key=elsigh_device.key.urlsafe(),
                                                      cid='test_cid',
                                                      means='4152223333',
                                                      name='Dustin Diaz',
                                                      type='phone'))
        self.assertNotEquals(None, response)
        q = models.Notifying.query(ancestor=elsigh_device.key)
        self.assertEquals(1, q.count())

        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals('test_cid', obj['cid'])
        self.assertEquals('4152223333', obj['means'])

        # notifying notification
        tasks = self.taskqueue_stub.GetTasks('default')
        self.assertEqual(1, len(tasks))
        #task = tasks[0]
        #logging.info('TASKEROO! %s', base64.b64decode(task["body"]))

        # Trying to notify them again should error.
        response = self.testapp.post_json('/api/notifying',
                                          params=dict(api_token=elsigh_user.api_token,
                                                      user_key=elsigh_user.key.urlsafe(),
                                                      device_key=elsigh_device.key.urlsafe(),
                                                      cid='test_cid',
                                                      means='4152223333',
                                                      name='Dustin Diaz',
                                                      type='phone'),
                                          status=409)
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals('exists', obj['error'])

    def test_ApiNotifyingHandler_delete(self):
        elsigh_user = models.FMBUser(
            name='elsigh'
        )
        elsigh_user.put()

        elsigh_device = models.Device(
            uuid='elsigh_uuid',
            parent=elsigh_user.key
        )
        elsigh_device.put()

        ded_notifying = models.Notifying(
            parent=elsigh_device.key,
            means='4152223333',
            name='Dustin Diaz',
            type='phone'
        )
        ded_notifying.put()

        q = models.Notifying.query(ancestor=elsigh_device.key)
        self.assertEquals(1, q.count())

        response = self.testapp.post_json('/api/notifying/delete',
                                          params=dict(api_token=elsigh_user.api_token,
                                                      user_key=elsigh_user.key.urlsafe(),
                                                      device_key=elsigh_device.key.urlsafe(),
                                                      key=ded_notifying.key.urlsafe()))
        self.assertNotEquals(None, response)
        q = models.Notifying.query(ancestor=elsigh_device.key)
        self.assertEquals(0, q.count())

        # Trying to delete ded again should error.
        self.testapp.post_json('/api/notifying/delete',
                               params=dict(api_token=elsigh_user.api_token,
                                           user_key=elsigh_user.key.urlsafe(),
                                           device_key=elsigh_device.key.urlsafe(),
                                           key=ded_notifying.key.urlsafe()),
                               status=404)

    def test_send_notifying_message_email(self):
        elsigh_user = models.FMBUser(
            name='elsigh'
        )
        elsigh_user.put()

        api.send_notifying_message(
            elsigh_user.key.id(),
            'email', 'Angela Pater', 'angela@commoner.com', send=False)

        q = models.NotificationSent.query(ancestor=elsigh_user.key)
        q = q.filter(models.NotificationSent.means == 'angela@commoner.com')
        self.assertEquals(1, q.count())

    def test_send_notifying_message_phone(self):
        elsigh_user = models.FMBUser(
            name='elsigh'
        )
        elsigh_user.put()

        api.send_notifying_message(
            elsigh_user.key.id(),
            'phone', 'Angela Pater', '512-736-6633', send=False)

        q = models.NotificationSent.query(ancestor=elsigh_user.key)
        q = q.filter(models.NotificationSent.means == '512-736-6633')
        self.assertEquals(1, q.count())

    def test_send_battery_notifications(self):
        elsigh_user = models.FMBUser(
            name='elsigh'
        )
        elsigh_user.put()

        elsigh_device = models.Device(
            uuid='elsigh_uuid',
            parent=elsigh_user.key
        )
        elsigh_device.put()

        ded_notifying = models.Notifying(
            parent=elsigh_device.key,
            means='4152223333',
            name='Dustin Diaz',
            type='phone'
        )
        ded_notifying.put()

        tasks = self.taskqueue_stub.GetTasks('default')
        self.assertEqual(0, len(tasks))

        api.send_battery_notifications(elsigh_user.key.id(),
                                       elsigh_device.key.id())

        tasks = self.taskqueue_stub.GetTasks('default')
        # other + self
        self.assertEqual(2, len(tasks))

    def test_send_notification_templater(self):
        elsigh_user = models.FMBUser(
            name='Lindsey Simon',
            given_name='Lindsey',
            unique_profile_str='elsigh'
        )
        elsigh_user.put()

        elsigh_device = models.Device(
            parent=elsigh_user.key,
            uuid='elsigh_uuid',
            platform='Android',
            name='Nexus 4'
        )
        elsigh_device.put()

        ded_notifying = models.Notifying(
            parent=elsigh_device.key,
            means='+15126989983',
            name='Dustin Diaz',
            type='phone'
        )
        ded_notifying.put()

        notifying, rendered = api._send_notification_templater(
            elsigh_user.key.id(), elsigh_device.key.id(),
            ded_notifying.key.id(),
            'notification_battery_email.html')
        self.assertEquals(
            ('\nLindsey Simon&#39;s Android Nexus 4 battery is running low '
             'at 10%.\n\nwww.levelsapp.com/p/elsigh'),
            rendered)

        notifying, rendered = api._send_notification_templater(
            elsigh_user.key.id(), elsigh_device.key.id(),
            ded_notifying.key.id(),
            'notification_battery_phone.html')
        self.assertEquals(
            ('Lindsey Simon\'s Android Nexus 4 battery is running low '
             'at 10%. www.levelsapp.com/p/elsigh'),
            rendered)

    def test_send_battery_notification_phone(self):
        elsigh_user = models.FMBUser(
            name='elsigh'
        )
        elsigh_user.put()

        elsigh_device = models.Device(
            uuid='elsigh_uuid',
            parent=elsigh_user.key
        )
        elsigh_device.put()

        ded_notifying = models.Notifying(
            parent=elsigh_device.key,
            means='+15126989983',
            name='Dustin Diaz',
            type='phone'
        )
        ded_notifying.put()

        api.send_battery_notification_phone(elsigh_user.key.id(),
                                            elsigh_device.key.id(),
                                            ded_notifying.key.id(),
                                            send=False)

        q = models.NotificationSent.query(ancestor=ded_notifying.key)
        self.assertEquals(1, q.count())

        # Try again, which should not send b/c time.
        api.send_battery_notification_phone(elsigh_user.key.id(),
                                            elsigh_device.key.id(),
                                            ded_notifying.key.id(),
                                            send=False)
        q = models.NotificationSent.query(ancestor=ded_notifying.key)
        self.assertEquals(1, q.count())

    def test_send_battery_notification_email(self):
        elsigh_user = models.FMBUser(
            name='elsigh'
        )
        elsigh_user.put()

        elsigh_device = models.Device(
            uuid='elsigh_uuid',
            parent=elsigh_user.key
        )
        elsigh_device.put()

        ded_notifying = models.Notifying(
            parent=elsigh_device.key,
            means='elsigh@gmail.com',
            name='Dustin Diaz',
            type='phone'
        )
        ded_notifying.put()

        api.send_battery_notification_email(elsigh_user.key.id(),
                                            elsigh_device.key.id(),
                                            ded_notifying.key.id(),
                                            send=False)

        q = models.NotificationSent.query(ancestor=ded_notifying.key)
        self.assertEquals(1, q.count())

        # Try again, which should not send b/c time.
        api.send_battery_notification_email(elsigh_user.key.id(),
                                            elsigh_device.key.id(),
                                            ded_notifying.key.id(),
                                            send=False)
        q = models.NotificationSent.query(ancestor=ded_notifying.key)
        self.assertEquals(1, q.count())

    def test_send_battery_notification_self(self):
        """This just tests that a NotificationSent entity gets created."""
        elsigh_user = models.FMBUser(
            name='elsigh'
        )
        elsigh_user.put()

        elsigh_device = models.Device(
            uuid='elsigh_uuid',
            name='foo',
            platform='bar',
            parent=elsigh_user.key
        )
        elsigh_device.put()

        api.send_battery_notification_self(elsigh_user.key.id(),
                                           elsigh_device.key.id())

        q = models.NotificationSent.query(ancestor=elsigh_user.key)
        q.filter(models.NotificationSent.means == 'self_battery_message')
        self.assertEquals(1, q.count())

    @patch.object(gcm.GCMConnection, 'notify_device')
    @patch('lib.external.gae_python_gcm.gcm.GCMMessage')
    def test_user_send_message_gcm(self, mock_gcm_message, mock_notify_device):
        elsigh_user = models.FMBUser(
            name='elsigh'
        )
        elsigh_user.put()

        elsigh_user.send_message('hi', extra={
            'foo': 'bar'
        })

        self.assertEquals(0, mock_notify_device.call_count)

        elsigh_device = models.Device(
            uuid='elsigh_uuid1',
            name='foo1',
            platform='bar1',
            parent=elsigh_user.key,
            gcm_push_token='test_gcm_push_token1'
        )
        elsigh_device.put()

        elsigh_device2 = models.Device(
            uuid='elsigh_uuid2',
            name='foo2',
            platform='bar2',
            parent=elsigh_user.key,
            gcm_push_token='test_gcm_push_token2'
        )
        elsigh_device2.put()

        elsigh_user.send_message('hi', extra={
            'foo': 'bar'
        })
        self.assertEquals(2, mock_notify_device.call_count)


        calls = [
            call(mock_gcm_message('test_gcm_push_token1', {
                'message': 'hi',
                'foo': 'bar'
            })),
            call(mock_gcm_message('test_gcm_push_token2', {
                'message': 'hi',
                'foo': 'bar'
            }))]
        mock_notify_device.assert_has_calls(calls)


    @patch.object(mail, 'send_mail')
    def test_user_send_message_mail(self, mock_send_mail):
        elsigh_user = models.FMBUser(
            name='elsigh',
            email='elsigh@gmail.com'
        )
        elsigh_user.send_message('hi')

        args = {
            'sender': settings.MAIL_FROM,
            'to': '%s <%s>' % (elsigh_user.name, elsigh_user.email),
            'subject': 'hi',
            'body': 'End of message. =)'
        }
        mock_send_mail.assert_called_once_with(**args)

    def test_user_possessive(self):
        user = models.FMBUser(
            name='elsigh moo',
            given_name='elsigh'
        )
        self.assertEquals('elsigh moo\'s', user.name_possessive)
        self.assertEquals('elsigh\'s', user.given_name_possessive)

        user = models.FMBUser(
            name='chris moos',
            given_name='chris'
        )
        self.assertEquals('chris moos\'', user.name_possessive)
        self.assertEquals('chris\'', user.given_name_possessive)

    def test_user_google_auth_ids(self):
        user = models.FMBUser(
            name='elsigh moo',
            auth_ids=['foo', 'google:bar', 'baz', 'google:bat']
        )
        user.put()
        self.assertEquals(['bar', 'bat'],
                          user.google_auth_ids)


class GlasswareHandlerTest(unittest.TestCase):
    def setUp(self):
        self.testbed = testbed.Testbed()
        self.testbed.setup_env(app_id='followmybattery')
        self.testbed.activate()
        self.testbed.init_datastore_v3_stub()
        self.testbed.init_taskqueue_stub()
        self.taskqueue_stub = self.testbed.get_stub(testbed.TASKQUEUE_SERVICE_NAME)
        self.testapp = webtest.TestApp(controllers.app)

    def tearDown(self):
        self.testbed.deactivate()

    def test_glassware(self):
        response = self.testapp.get('/glassware', status=302)
        assert response

    @patch.object(discovery, 'build')
    def test_notify(self, mock_build=None):
        user = models.FMBUser(
            name='elsigh moo',
            auth_ids=['google:abc'],
            oauth2_access_token='test_oauth2_access_token',
            oauth2_refresh_token='test_oauth2_refresh_token',
            oauth2_expires_datetime='test_oauth2_expires_datetime'
        )
        user.put()

        item_id = 'item_id'

        # Sets up our mock to return a timeline item
        execute_mock = mock_build().timeline().get(id=item_id).execute
        datetime_not_now = '2013-07-08T15:54:12.865Z'
        timeline_item = {
            'created': datetime_not_now,
            'text': '{"capacity": 57, "is_charging": true}'
        }
        execute_mock.return_value = timeline_item

        payload = {
            'collection': 'timeline',
            'itemId': item_id,
            'operation': 'INSERT',
            'userToken': 'abc',
            'userActions': [{'type': 'SHARE'}]
        }
        response = self.testapp.post('/glassware/notify', json.dumps(payload))

        # Created a glass device for this user with one setting value.
        glass_device_query = models.Device.query(
            ancestor=user.key).filter(
                models.Device.uuid == 'glass')
        self.assertEquals(1, glass_device_query.count())
        glass_device = glass_device_query.get()
        self.assertEquals(1, len(glass_device.settings))
        stored_setting = glass_device.settings[0]
        self.assertEquals(models.FMBModel.iso_str_to_datetime(datetime_not_now),
                          stored_setting.created)
        self.assertEquals(57, stored_setting.battery_level)
        self.assertEquals(True, stored_setting.is_charging)

        ########
        # A second call should tack-on a setting to the existing-made
        # glass device.
        item_id = 'item_id_2'
        execute_mock = mock_build().timeline().get(id=item_id).execute
        datetime_not_now = '2013-07-08T16:04:12.865Z'
        timeline_item = {
            'created': datetime_not_now,
            'text': '{"capacity": 47, "is_charging": false}'
        }
        execute_mock.return_value = timeline_item

        payload = {
            'collection': 'timeline',
            'itemId': item_id,
            'operation': 'INSERT',
            'userToken': 'abc',
            'userActions': [{'type': 'SHARE'}]
        }
        response = self.testapp.post('/glassware/notify', json.dumps(payload))
        assert response
        self.assertEquals(2, models.Settings.query().count())
        self.assertEquals(2, len(glass_device.settings))
