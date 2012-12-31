#!/usr/bin/python2.7
#
#

import json
import os
import sys

# Need the server root dir on the path.
sys.path.append(os.path.dirname(os.path.abspath(__file__)) + '/..')

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
        self.testapp = webtest.TestApp(controllers.app)

    def test_ApiProfileRequestHandler(self):
        self.testapp.get('/api/profile/foo', status=404)

        response = self.testapp.post_json('/api/profile/',
                                          params=dict(username="elsigh",
                                                      id="foo"))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals('elsigh', obj['username'])
        self.assertTrue('auth_token' in obj)
        self.assertNotEquals('', obj['auth_token'])

        # Trying to create again with this username should fail.
        response = self.testapp.post_json('/api/profile/',
                                          params=dict(username="elsigh",
                                                      id="foo"),
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
            id="someid",
            username="elsighmon",
            auth_token="test_auth_token"
        )
        profile.put()

        # Without an auth_token, we should bomb.
        response = self.testapp.post_json('/api/device/some_uuid',
                                          params=dict(uuid="test_device_uuid",
                                                      user_agent_string="ua"),
                                          status=500)

        # Without a *matching* auth_token, we should bomb.
        response = self.testapp.post_json('/api/device/some_uuid',
                                          params=dict(auth_token="NOMATCH",
                                                      uuid="test_device_uuid",
                                                      user_agent_string="ua"),
                                          status=500)

        # Create a device associated with that profile.
        response = self.testapp.post_json('/api/device/some_uuid',
                                          params=dict(auth_token="test_auth_token",
                                                      uuid="test_device_uuid",
                                                      user_agent_string="ua",
                                                      update_enabled="1",
                                                      update_frequency="20",
                                                      name="Samsung",
                                                      platform="Android",
                                                      version="S3"))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(1, obj['update_enabled'])

        # Test an ancestor query
        q = db.Query(models.Device).ancestor(profile.key())
        self.assertEquals(1, q.count())
        query_device = q.get()
        self.assertEquals("test_device_uuid", query_device.uuid)

        # Tests an update to that device.
        response = self.testapp.post_json('/api/device/some_uuid',
                                          params=dict(auth_token="test_auth_token",
                                                      uuid="test_device_uuid",
                                                      user_agent_string="ua",
                                                      update_enabled="0",
                                                      update_frequency="20",
                                                      name="Samsung",
                                                      platform="Android",
                                                      version="S3"))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(0, obj['update_enabled'])

    def test_ApiBatteryRequestHandler(self):
        profile = models.Profile(
            id="someid",
            username="elsighmon",
            auth_token="test_auth_token"
        )
        profile.put()

        device = models.Device(
            uuid="test_device_uuid",
            parent=profile
        )
        device.put()

        response = self.testapp.post_json('/api/battery/some_uuid',
                                          params=dict(auth_token="test_auth_token",
                                                      uuid="test_device_uuid",
                                                      level=82,
                                                      is_charging=0))

        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(82, obj['level'])

    def test_ApiFollowingRequestHandler(self):
        profile = models.Profile(
            id="someid",
            username="elsighmon",
            auth_token="elsigh_auth_token"
        )
        profile.put()

        jr_profile = models.Profile(
            id="jr_id",
            username="jr",
            auth_token="jr_auth_token"
        )
        jr_profile.put()

        jr_device = models.Device(
            uuid="jr_uuid",
            parent=jr_profile
        )
        jr_device.put()

        jr_battery = models.Battery(
           parent=jr_device,
           level=75,
           is_charging=1
        )
        jr_battery.put()

        jr_following = models.Following(
            following=jr_profile,
            parent=profile
        )
        jr_following.put()

        ded_profile = models.Profile(
            id="ded_id",
            username="ded",
            auth_token="ded_auth_token"
        )
        ded_profile.put()

        ded_device = models.Device(
            uuid="ded_uuid",
            parent=ded_profile
        )
        ded_device.put()

        ded_battery = models.Battery(
           parent=ded_device,
           level=35,
           is_charging=0
        )
        ded_battery.put()

        ded_following = models.Following(
            following=ded_profile,
            parent=profile
        )
        ded_following.put()

        # Gut check on the ancestor query thing.
        q = db.Query(models.Following).ancestor(profile.key())
        self.assertEquals(2, q.count())

        response = self.testapp.get('/api/following/elsigh',
                                    params=dict(auth_token="elsigh_auth_token"))
        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals(2, len(obj['following']))

    def test_ApiFollowingRequestHandler_add(self):
        profile = models.Profile(
            id="someid",
            username="elsighmon",
            auth_token="elsigh_auth_token"
        )
        profile.put()

        ded_profile = models.Profile(
            id="ded_id",
            username="ded",
            auth_token="ded_auth_token"
        )
        ded_profile.put()

        response = self.testapp.post_json('/api/following/elsighmon',
                                          params=dict(auth_token="elsigh_auth_token",
                                                      username="ded"))

        body = response.normal_body
        obj = json.loads(body)
        self.assertEquals('ded', obj['username'])


