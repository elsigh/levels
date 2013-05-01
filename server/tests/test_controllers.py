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

from google.appengine.ext import ndb
from google.appengine.ext import testbed

from webapp2_extras.appengine.auth.models import User

import unittest
import webtest

from lib.web_request_handler import WebRequestHandler
from lib import api
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
        WebRequestHandler.unit_test_current_user = None

    # def test_ApiUserRequestHandler(self):
    #     self.testapp.get('/api/user/foo', status=404)

    #     response = self.testapp.post_json('/api/user/',
    #                                       params=dict(name='elsigh',
    #                                                   id='foo'))
    #     body = response.normal_body
    #     obj = json.loads(body)
    #     self.assertEquals('elsigh', obj['name'])
    #     self.assertTrue('api_token' in obj)
    #     self.assertNotEquals('', obj['api_token'])

    #     # Trying to create again with this name should fail.
    #     response = self.testapp.post_json('/api/user/',
    #                                       params=dict(name='elsigh',
    #                                                   id='foo'),
    #                                       status=409)
    #     body = response.normal_body
    #     obj = json.loads(body)
    #     self.assertEquals('exists', obj['error'])

    #     # But we should be able to retrieve it, sans api_token.
    #     response = self.testapp.get('/api/user/elsigh')
    #     body = response.normal_body
    #     obj = json.loads(body)
    #     self.assertEquals('elsigh', obj['name'])
    #     self.assertTrue('api_token' not in obj)

    def test_ApiDeviceRequestHandler(self):
        user = User(
            id='someid',
            name='elsighmon',
            api_token='test_api_token'
        )
        user.put()
        WebRequestHandler.unit_test_current_user = user

        # Without an api_token, we should bomb.
        response = self.testapp.post_json('/api/device',
                                          params=dict(device_uuid='test_device_uuid',
                                                      user_agent_string='ua'),
                                          status=500)

        # Without a *matching* api_token, we should bomb.
        response = self.testapp.post_json('/api/device',
                                          params=dict(api_token='NOMATCH',
                                                      device_uuid='test_device_uuid',
                                                      user_agent_string='ua'),
                                          status=500)

        # Create a device associated with that user.
        response = self.testapp.post_json('/api/device',
                                          params=dict(api_token='test_api_token',
                                                      device_uuid='test_device_uuid',
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
        q = models.Device.query(ancestor=user.key)
        self.assertEquals(1, q.count())
        query_device = q.get()
        self.assertEquals('test_device_uuid', query_device.uuid)

        # Tests an update to that device.
        response = self.testapp.post_json('/api/device',
                                          params=dict(api_token='test_api_token',
                                                      device_uuid='test_device_uuid',
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
        elsigh_user = User(
            id='someid',
            name='elsighmon',
            api_token='test_api_token'
        )
        elsigh_user.put()
        WebRequestHandler.unit_test_current_user = elsigh_user

        elsigh_device = models.Device(
            uuid='test_device_uuid',
            parent=elsigh_user.key,
            notify_level=10
        )
        elsigh_device.put()

        response = self.testapp.post_json('/api/settings',
                                          params=dict(api_token='test_api_token',
                                                      device_uuid='test_device_uuid',
                                                      battery_level=82,
                                                      is_charging=0))


        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(82, obj['battery_level'])
        self.assertTrue(obj['is_last_update_over_notify_level'])

        tasks = self.taskqueue_stub.GetTasks('default')
        self.assertEqual(0, len(tasks))

        response = self.testapp.post_json('/api/settings',
                                          params=dict(api_token='test_api_token',
                                                      device_uuid='test_device_uuid',
                                                      battery_level=9,
                                                      is_charging=0))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(9, obj['battery_level'])
        self.assertFalse(obj['is_last_update_over_notify_level'])

        tasks = self.taskqueue_stub.GetTasks('default')
        self.assertEqual(1, len(tasks))

        response = self.testapp.post_json('/api/settings',
                                          params=dict(api_token='test_api_token',
                                                      device_uuid='test_device_uuid',
                                                      battery_level=11,
                                                      is_charging=0))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(11, obj['battery_level'])
        self.assertTrue(obj['is_last_update_over_notify_level'])

    def test_ApiFollowingRequestHandler(self):
        user = User(
            id='someid',
            name='elsighmon',
            api_token='elsigh_api_token'
        )
        user.put()
        WebRequestHandler.unit_test_current_user = user

        jr_user = User(
            id='jr_id',
            name='jr',
            api_token='jr_api_token'
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
            parent=user.key
        )
        jr_following.put()

        ded_user = User(
            id='ded_id',
            name='ded',
            api_token='ded_api_token'
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
            parent=user.key
        )
        ded_following.put()

        # Gut check on the ancestor query thing.
        q = models.Following.query(ancestor=user.key)
        self.assertEquals(2, q.count())

        response = self.testapp.get('/api/following',
                                    params=dict(api_token='elsigh_api_token',
                                                user_key='elsigh'))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(2, len(obj['following']))

    def test_ApiFollowingRequestHandler_add(self):
        user = User(
            id='someid',
            name='elsighmon',
            api_token='elsigh_api_token'
        )
        user.put()
        WebRequestHandler.unit_test_current_user = user

        ded_user = User(
            id='ded_id',
            name='ded',
            api_token='ded_api_token'
        )
        ded_user.put()
        logging.info('DED KEY:: %s', ded_user.key.urlsafe())
        response = self.testapp.post_json('/api/following',
                                          params=dict(api_token='elsigh_api_token',
                                                      user_key=ded_user.key.urlsafe()))
        return

        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals('ded', obj['name'])

        # Trying to follow ded again should error.
        response = self.testapp.post_json('/api/following',
                                          params=dict(api_token='elsigh_api_token',
                                                      user_key=ded_user.key.urlsafe()),
                                          status=409)
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals('exists', obj['error'])

    def test_ApiFollowingRequestHandler_delete(self):
        elsigh_user = User(
            id='someid',
            name='elsighmon',
            api_token='elsigh_api_token'
        )
        elsigh_user.put()
        WebRequestHandler.unit_test_current_user = elsigh_user

        ded_user = User(
            id='ded_id',
            name='ded',
            api_token='ded_api_token'
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
                                          params=dict(api_token='elsigh_api_token',
                                                      user_key=ded_user.key.urlsafe()))

        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals('ded', obj['name'])

        q = models.Following.query(ancestor=elsigh_user.key)
        self.assertEquals(0, q.count())

        # Trying to delete ded again should error.
        self.testapp.post_json('/api/following/delete',
                               params=dict(api_token='elsigh_api_token',
                                           user_key=ded_user.key.urlsafe()),
                               status=404)

    def test_ApiNotifyingRequestHandler_get(self):
        elsigh_user = User(
            id='someid',
            name='elsighmon',
            api_token='elsigh_api_token'
        )
        elsigh_user.put()
        WebRequestHandler.unit_test_current_user = elsigh_user

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
                                    params=dict(api_token='elsigh_api_token',
                                                device_uuid='elsigh_uuid'))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(2, len(obj['notifying']))

    def test_ApiNotifyingRequestHandler_add(self):
        elsigh_user = User(
            id='someid',
            name='elsighmon',
            api_token='elsigh_api_token'
        )
        elsigh_user.put()
        WebRequestHandler.unit_test_current_user = elsigh_user

        elsigh_device = models.Device(
            uuid='elsigh_uuid',
            parent=elsigh_user.key
        )
        elsigh_device.put()

        response = self.testapp.post_json('/api/notifying',
                                          params=dict(api_token='elsigh_api_token',
                                                      device_uuid=elsigh_device.uuid,
                                                      means='4152223333',
                                                      name='Dustin Diaz',
                                                      type='phone'))
        self.assertNotEquals(None, response)
        q = models.Notifying.query(ancestor=elsigh_device.key)
        self.assertEquals(1, q.count())

        # Trying to notify them again should error.
        response = self.testapp.post_json('/api/notifying',
                                          params=dict(api_token='elsigh_api_token',
                                                      device_uuid=elsigh_device.uuid,
                                                      means='4152223333'),
                                          status=409)
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals('exists', obj['error'])

    def test_ApiNotifyingRequestHandler_delete(self):
        elsigh_user = User(
            id='someid',
            name='elsighmon',
            api_token='elsigh_api_token'
        )
        elsigh_user.put()
        WebRequestHandler.unit_test_current_user = elsigh_user

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
                                          params=dict(api_token='elsigh_api_token',
                                                      device_uuid=elsigh_device.uuid,
                                                      means='4152223333'))
        self.assertNotEquals(None, response)
        q = models.Notifying.query(ancestor=elsigh_device.key)
        self.assertEquals(0, q.count())

        # Trying to delete ded again should error.
        self.testapp.post_json('/api/notifying/delete',
                               params=dict(api_token='elsigh_api_token',
                                           device_uuid=elsigh_device.uuid,
                                           means='4152223333'),
                               status=404)

    def test_send_battery_notifications(self):
        elsigh_user = User(
            id='someid',
            name='elsighmon',
            api_token='elsigh_api_token'
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
        self.assertEqual(1, len(tasks))

    def test_send_battery_notification_phone(self):
        elsigh_user = User(
            id='someid',
            name='elsighmon',
            api_token='elsigh_api_token'
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
        elsigh_user = User(
            id='someid',
            name='elsighmon',
            api_token='elsigh_api_token'
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

