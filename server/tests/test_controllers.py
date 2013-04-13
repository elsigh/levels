#!/usr/bin/python2.7
#
#

import base64
import json
import os
import sys

# Need the server root dir on the path.
sys.path.append(os.path.dirname(os.path.abspath(__file__)) + '/..')

import logging

from google.appengine.ext import db
from google.appengine.ext import testbed

import unittest
import webtest

from lib import controllers
from lib import models


class RequestHandlerTest(unittest.TestCase):
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

    def test_ApiProfileRequestHandler(self):
        self.testapp.get('/api/profile/foo', status=404)

        response = self.testapp.post_json('/api/profile/',
                                          params=dict(username='elsigh',
                                                      id='foo'))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals('elsigh', obj['username'])
        self.assertTrue('auth_token' in obj)
        self.assertNotEquals('', obj['auth_token'])

        # Trying to create again with this username should fail.
        response = self.testapp.post_json('/api/profile/',
                                          params=dict(username='elsigh',
                                                      id='foo'),
                                          status=409)
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals('exists', obj['error'])

        # But we should be able to retrieve it, sans auth_token.
        response = self.testapp.get('/api/profile/elsigh')
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals('elsigh', obj['username'])
        self.assertTrue('auth_token' not in obj)

    def test_ApiDeviceRequestHandler(self):
        profile = models.Profile(
            id='someid',
            username='elsighmon',
            auth_token='test_auth_token'
        )
        profile.put()

        # Without an auth_token, we should bomb.
        response = self.testapp.post_json('/api/device/some_uuid',
                                          params=dict(uuid='test_device_uuid',
                                                      user_agent_string='ua'),
                                          status=500)

        # Without a *matching* auth_token, we should bomb.
        response = self.testapp.post_json('/api/device/some_uuid',
                                          params=dict(auth_token='NOMATCH',
                                                      uuid='test_device_uuid',
                                                      user_agent_string='ua'),
                                          status=500)

        # Create a device associated with that profile.
        response = self.testapp.post_json('/api/device/some_uuid',
                                          params=dict(auth_token='test_auth_token',
                                                      uuid='test_device_uuid',
                                                      user_agent_string='ua',
                                                      update_enabled='1',
                                                      update_frequency='20',
                                                      name='Samsung',
                                                      platform='Android',
                                                      version='S3'))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(1, obj['update_enabled'])

        # Test an ancestor query
        q = db.Query(models.Device).ancestor(profile.key())
        self.assertEquals(1, q.count())
        query_device = q.get()
        self.assertEquals('test_device_uuid', query_device.uuid)

        # Tests an update to that device.
        response = self.testapp.post_json('/api/device/some_uuid',
                                          params=dict(auth_token='test_auth_token',
                                                      uuid='test_device_uuid',
                                                      user_agent_string='ua',
                                                      update_enabled='0',
                                                      update_frequency='20',
                                                      name='Samsung',
                                                      platform='Android',
                                                      version='S3'))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(0, obj['update_enabled'])

    def test_ApiSettingsRequestHandler(self):
        elsigh_profile = models.Profile(
            id='someid',
            username='elsighmon',
            auth_token='test_auth_token'
        )
        elsigh_profile.put()

        elsigh_device = models.Device(
            uuid='test_device_uuid',
            parent=elsigh_profile,
            notify_level=10
        )
        elsigh_device.put()

        response = self.testapp.post_json('/api/settings/test_device_uuid',
                                          params=dict(auth_token='test_auth_token',
                                                      uuid='test_device_uuid',
                                                      battery_level=82,
                                                      is_charging=0))

        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(82, obj['battery_level'])
        self.assertTrue(obj['is_last_update_over_notify_level'])

        tasks = self.taskqueue_stub.GetTasks('default')
        self.assertEqual(0, len(tasks))

        response = self.testapp.post_json('/api/settings/test_device_uuid',
                                          params=dict(auth_token='test_auth_token',
                                                      uuid='test_device_uuid',
                                                      battery_level=9,
                                                      is_charging=0))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(9, obj['battery_level'])
        self.assertFalse(obj['is_last_update_over_notify_level'])

        tasks = self.taskqueue_stub.GetTasks('default')
        self.assertEqual(1, len(tasks))

        response = self.testapp.post_json('/api/settings/test_device_uuid',
                                          params=dict(auth_token='test_auth_token',
                                                      uuid='test_device_uuid',
                                                      battery_level=11,
                                                      is_charging=0))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(11, obj['battery_level'])
        self.assertTrue(obj['is_last_update_over_notify_level'])

    def test_ApiFollowingRequestHandler(self):
        profile = models.Profile(
            id='someid',
            username='elsighmon',
            auth_token='elsigh_auth_token'
        )
        profile.put()

        jr_profile = models.Profile(
            id='jr_id',
            username='jr',
            auth_token='jr_auth_token'
        )
        jr_profile.put()

        jr_device = models.Device(
            uuid='jr_uuid',
            parent=jr_profile
        )
        jr_device.put()

        jr_settings = models.Settings(
           parent=jr_device,
           battery_level=75,
           is_charging=1
        )
        jr_settings.put()

        jr_following = models.Following(
            following=jr_profile,
            parent=profile
        )
        jr_following.put()

        ded_profile = models.Profile(
            id='ded_id',
            username='ded',
            auth_token='ded_auth_token'
        )
        ded_profile.put()

        ded_device = models.Device(
            uuid='ded_uuid',
            parent=ded_profile
        )
        ded_device.put()

        ded_settings = models.Settings(
           parent=ded_device,
           battery_level=35,
           is_charging=0
        )
        ded_settings.put()

        ded_following = models.Following(
            following=ded_profile,
            parent=profile
        )
        ded_following.put()

        # Gut check on the ancestor query thing.
        q = db.Query(models.Following).ancestor(profile.key())
        self.assertEquals(2, q.count())

        response = self.testapp.get('/api/following/elsigh',
                                    params=dict(auth_token='elsigh_auth_token'))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(2, len(obj['following']))

    def test_ApiFollowingRequestHandler_add(self):
        profile = models.Profile(
            id='someid',
            username='elsighmon',
            auth_token='elsigh_auth_token'
        )
        profile.put()

        ded_profile = models.Profile(
            id='ded_id',
            username='ded',
            auth_token='ded_auth_token'
        )
        ded_profile.put()

        response = self.testapp.post_json('/api/following/elsighmon',
                                          params=dict(auth_token='elsigh_auth_token',
                                                      username='ded'))

        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals('ded', obj['username'])

        # Trying to follow ded again should error.
        response = self.testapp.post_json('/api/following/elsighmon',
                                          params=dict(auth_token='elsigh_auth_token',
                                                      username='ded'),
                                          status=409)
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals('exists', obj['error'])

    def test_ApiFollowingRequestHandler_delete(self):
        elsigh_profile = models.Profile(
            id='someid',
            username='elsighmon',
            auth_token='elsigh_auth_token'
        )
        elsigh_profile.put()

        ded_profile = models.Profile(
            id='ded_id',
            username='ded',
            auth_token='ded_auth_token'
        )
        ded_profile.put()

        following = models.Following(
            parent=elsigh_profile,
            following=ded_profile
        )
        following.put()

        q = db.Query(models.Following).ancestor(elsigh_profile.key())
        self.assertEquals(1, q.count())

        response = self.testapp.post_json('/api/following/delete/elsighmon',
                                          params=dict(auth_token='elsigh_auth_token',
                                                      username='ded'))

        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals('ded', obj['username'])

        q = db.Query(models.Following).ancestor(elsigh_profile.key())
        self.assertEquals(0, q.count())

        # Trying to delete ded again should error.
        self.testapp.post_json('/api/following/delete/elsighmon',
                               params=dict(auth_token='elsigh_auth_token',
                                           username='ded'),
                               status=404)

    def test_ApiNotifyingRequestHandler_get(self):
        elsigh_profile = models.Profile(
            id='someid',
            username='elsighmon',
            auth_token='elsigh_auth_token'
        )
        elsigh_profile.put()

        elsigh_device = models.Device(
            uuid='elsigh_uuid',
            parent=elsigh_profile
        )
        elsigh_device.put()

        ded_notifying = models.Notifying(
            parent=elsigh_device,
            means='4152223333',
            name='Dustin Diaz',
            type='phone'
        )
        ded_notifying.put()

        jr_notifying = models.Notifying(
            parent=elsigh_device,
            means='4158889999',
            name='John Forsythe',
            type='phone'
        )
        jr_notifying.put()

        # Gut check on the ancestor query thing.
        q = db.Query(models.Notifying).ancestor(elsigh_device.key())
        self.assertEquals(2, q.count())

        response = self.testapp.get('/api/notifying/elsigh',
                                    params=dict(auth_token='elsigh_auth_token',
                                                uuid='elsigh_uuid'))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(2, len(obj['notifying']))

    def test_ApiNotifyingRequestHandler_add(self):
        elsigh_profile = models.Profile(
            id='someid',
            username='elsighmon',
            auth_token='elsigh_auth_token'
        )
        elsigh_profile.put()

        elsigh_device = models.Device(
            uuid='elsigh_uuid',
            parent=elsigh_profile
        )
        elsigh_device.put()

        response = self.testapp.post_json('/api/notifying/elsighmon',
                                          params=dict(auth_token='elsigh_auth_token',
                                                      uuid=elsigh_device.uuid,
                                                      means='4152223333',
                                                      name='Dustin Diaz',
                                                      type='phone'))
        self.assertNotEquals(None, response)
        q = db.Query(models.Notifying).ancestor(elsigh_device.key())
        self.assertEquals(1, q.count())

        # Trying to notify them again should error.
        response = self.testapp.post_json('/api/notifying/elsighmon',
                                          params=dict(auth_token='elsigh_auth_token',
                                                      uuid=elsigh_device.uuid,
                                                      means='4152223333'),
                                          status=409)
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals('exists', obj['error'])

    def test_ApiNotifyingRequestHandler_delete(self):
        elsigh_profile = models.Profile(
            id='someid',
            username='elsighmon',
            auth_token='elsigh_auth_token'
        )
        elsigh_profile.put()

        elsigh_device = models.Device(
            uuid='elsigh_uuid',
            parent=elsigh_profile
        )
        elsigh_device.put()

        ded_notifying = models.Notifying(
            parent=elsigh_device,
            means='4152223333',
            name='Dustin Diaz',
            type='phone'
        )
        ded_notifying.put()

        q = db.Query(models.Notifying).ancestor(elsigh_device.key())
        self.assertEquals(1, q.count())

        response = self.testapp.post_json('/api/notifying/delete/elsighmon',
                                          params=dict(auth_token='elsigh_auth_token',
                                                      uuid=elsigh_device.uuid,
                                                      means='4152223333'))
        self.assertNotEquals(None, response)
        q = db.Query(models.Notifying).ancestor(elsigh_device.key())
        self.assertEquals(0, q.count())

        # Trying to delete ded again should error.
        self.testapp.post_json('/api/notifying/delete/elsighmon',
                               params=dict(auth_token='elsigh_auth_token',
                                           uuid=elsigh_device.uuid,
                                           means='4152223333'),
                               status=404)

    def test_send_battery_notifications(self):
        elsigh_profile = models.Profile(
            id='someid',
            username='elsighmon',
            auth_token='elsigh_auth_token'
        )
        elsigh_profile.put()

        elsigh_device = models.Device(
            uuid='elsigh_uuid',
            parent=elsigh_profile
        )
        elsigh_device.put()

        ded_notifying = models.Notifying(
            parent=elsigh_device,
            means='4152223333',
            name='Dustin Diaz',
            type='phone'
        )
        ded_notifying.put()

        tasks = self.taskqueue_stub.GetTasks('default')
        self.assertEqual(0, len(tasks))

        controllers.send_battery_notifications(elsigh_profile.key().id(),
                                               elsigh_device.key().id())

        tasks = self.taskqueue_stub.GetTasks('default')
        self.assertEqual(1, len(tasks))

    def test_send_battery_notification_phone(self):
        elsigh_profile = models.Profile(
            id='someid',
            username='elsighmon',
            auth_token='elsigh_auth_token'
        )
        elsigh_profile.put()

        elsigh_device = models.Device(
            uuid='elsigh_uuid',
            parent=elsigh_profile
        )
        elsigh_device.put()

        ded_notifying = models.Notifying(
            parent=elsigh_device,
            means='+15126989983',
            name='Dustin Diaz',
            type='phone'
        )
        ded_notifying.put()

        controllers.send_battery_notification_phone(elsigh_profile.key().id(),
                                                    elsigh_device.key().id(),
                                                    ded_notifying.key().id(),
                                                    send=False)

        q = db.Query(models.NotificationSent).ancestor(ded_notifying.key())
        self.assertEquals(1, q.count())

        # Try again, which should not send b/c time.
        controllers.send_battery_notification_phone(elsigh_profile.key().id(),
                                                    elsigh_device.key().id(),
                                                    ded_notifying.key().id(),
                                                    send=False)
        q = db.Query(models.NotificationSent).ancestor(ded_notifying.key())
        self.assertEquals(1, q.count())

    def test_send_battery_notification_email(self):
        elsigh_profile = models.Profile(
            id='someid',
            username='elsighmon',
            auth_token='elsigh_auth_token'
        )
        elsigh_profile.put()

        elsigh_device = models.Device(
            uuid='elsigh_uuid',
            parent=elsigh_profile
        )
        elsigh_device.put()

        ded_notifying = models.Notifying(
            parent=elsigh_device,
            means='elsigh@gmail.com',
            name='Dustin Diaz',
            type='phone'
        )
        ded_notifying.put()

        controllers.send_battery_notification_email(elsigh_profile.key().id(),
                                                    elsigh_device.key().id(),
                                                    ded_notifying.key().id(),
                                                    send=False)

        q = db.Query(models.NotificationSent).ancestor(ded_notifying.key())
        self.assertEquals(1, q.count())

        # Try again, which should not send b/c time.
        controllers.send_battery_notification_email(elsigh_profile.key().id(),
                                                    elsigh_device.key().id(),
                                                    ded_notifying.key().id(),
                                                    send=False)
        q = db.Query(models.NotificationSent).ancestor(ded_notifying.key())
        self.assertEquals(1, q.count())

