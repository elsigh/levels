#!/usr/bin/python2.7
#
#

from datetime import datetime, timedelta
import json
import logging
import os
import sys
import webapp2
import urllib2
import uuid

os.environ['DJANGO_SETTINGS_MODULE'] = 'settings'

from django.template.loader import get_template
from django.template import Context

from google.appengine.api import mail
from google.appengine.ext import db
from google.appengine.ext import deferred

from lib.web_request_handler import WebRequestHandler
from lib import models

sys.path.append(os.path.join(os.path.dirname(__file__), 'external'))
from lib.external.twilio.rest import TwilioRestClient

# last import.
import settings

TWILIO_ACCOUNT_SID = "AC13e0edad6a784369a6500a5159be461a"
TWILIO_AUTH_TOKEN = "39e9b2ee9eab31146cac977c1640321c"


def requires_auth_token(func):
    def _wrapper(request, *args, **kw):
        request.session['api_key_override'] = request.REQUEST.get('api_key', False)
        return func(request, *args, **kw)
    return _wrapper


class ApiRequestHandler(WebRequestHandler):
    def initialize(self, request, response):
        logging.info('ApiRequestHandler initialize w/ %s' % request.method)
        super(ApiRequestHandler, self).initialize(request, response)
        self._set_json_request_data()

    def _set_json_request_data(self):
        self._json_request_data = {}
        content_type = self.request.headers.get('content-type')
        #logging.info('_set_json_request_data CONTENT_TYPE:: %s' % self.request.headers)
        if content_type and 'application/json' in content_type:
            json_request = self.request.body
            json_request = urllib2.unquote(json_request).decode('utf-8')
            json_request = json_request.strip('=')
            try:
                self._json_request_data = json.loads(json_request)
            except Exception, e:
                logging.info('_set_json_request_data - %s - %s',
                             str(e),
                             json_request)

        # THIS IS GHETTO dumping this data into the _json_request_data
        # Did this b/c the syntax to check _json_request_data for key
        # existence is also pretty ugly and these two fields are pretty key.
        elif self.request.method == 'GET':
            if self.request.get('auth_token'):
                self._json_request_data['auth_token'] = self.request.get('auth_token')
            if self.request.get('uuid'):
                self._json_request_data['uuid'] = self.request.get('uuid')

        logging.info('JSON REQ DATA: %s' % self._json_request_data)

    # Backbone.js likes to use put for update, we call it POST.
    def put(self, *args):
        self.post(*args)

    def options(self, *args):
        self.output_json_success()

    def output_json(self, obj):
        self.apply_cors_headers()
        self.response.headers['Content-Type'] = 'application/json'
        logging.info('output_json response: %s' % obj)
        self.response.out.write(json.dumps(obj))

    def output_json_success(self, obj={}):
        obj['status'] = 0
        self.output_json(obj)

    def output_json_error(self, obj={}, error_code=404):
        obj['status'] = 1
        self.response.set_status(error_code)
        self.output_json(obj)

    def set_and_assert_profile(self):
        auth_token = self._json_request_data['auth_token']
        assert auth_token
        q = db.Query(models.Profile).filter('auth_token =', auth_token)
        profile = q.get()
        assert profile
        self._profile = profile

    def set_and_assert_device(self):
        device_uuid = self._json_request_data['uuid']
        q = db.Query(models.Device)
        q.ancestor(self._profile.key())
        q.filter('uuid =', device_uuid)
        device = q.get()
        assert device
        self._device = device


class ApiProfileRequestHandler(ApiRequestHandler):
    def get(self, username=None):
        assert username
        assert len(username) >= 3

        q = db.Query(models.Profile).filter('username =', username)
        if q.count() == 0:
            return self.output_json_error()
        else:
            profile = q.get()
            return self.output_json_success(models.to_dict(profile))

    def post(self, username=None):
        assert self._json_request_data
        username = self._json_request_data['username']
        assert username
        assert len(username) >= 3

        q = db.Query(models.Profile).filter('username =', username)

        if q.count() != 0:
            return self.output_json_error({'error': 'exists'}, 409)
        else:
            profile = models.Profile(
                id=self._json_request_data['id'],
                username=username,
                auth_token=str(uuid.uuid4())
            )
            profile.put()

            # Include auth_token, which is otherwise never sent down the wire.
            obj = models.to_dict(profile, include_auth_token=True)
            return self.output_json_success(obj)


class ApiDeviceRequestHandler(ApiRequestHandler):
    def get(self, uuid=None):
        q = db.Query(models.Device).filter('uuid =', uuid)
        device = q.get()
        return self.output_json_success(models.to_dict(device))

    def post(self, uuid=None):
        self.set_and_assert_profile()

        q = db.Query(models.Device).filter('uuid =', uuid)
        if q.count() == 0:
            device = models.Device(
                uuid=self._json_request_data['uuid'],
                parent=self._profile
            )
        else:
            device = q.get()

        device.parent_username = self._profile.username
        device.user_agent_string = self._json_request_data['user_agent_string']
        device.update_enabled = int(self._json_request_data['update_enabled'])
        device.update_frequency = int(self._json_request_data['update_frequency'])
        if 'notify_level' in self._json_request_data:
            device.notify_level = int(self._json_request_data['notify_level'])
        device.name = self._json_request_data['name']
        device.platform = self._json_request_data['platform']
        device.version = self._json_request_data['version']
        device.put()

        return self.output_json_success(models.to_dict(device))


def _send_notification_templater(profile_id, device_id, notifying_id, tpl_name):
    logging.info('_send_notification_templater %s, %s, %s' %
                 (profile_id, device_id, tpl_name))
    profile = models.Profile.get_by_id(profile_id)
    device = models.Device.get_by_id(device_id, parent=profile)
    notifying = models.Notifying.get_by_id(notifying_id, parent=device)
    logging.info('send_battery_notification_phone %s, %s, %s' %
                 (profile.username, device.uuid, notifying.means))

    # Make sure we haven't sent this means a notification in the last N hours.
    q = db.Query(models.NotificationSent).ancestor(device.key())
    q.filter('means =', notifying.means)

    from_time = datetime.now() - timedelta(hours=12)
    q.filter('created >', from_time)

    if q.count() != 0:
        logging.info('Nope, we already sent them a notification recently.')
        return None, None

    tpl_data = {
        'profile': models.to_dict(profile),
        'device': models.to_dict(device),
        'notifying': models.to_dict(notifying)
    }
    tpl = get_template(tpl_name)
    rendered = tpl.render(Context(tpl_data))
    return notifying, rendered


def send_battery_notification_email(profile_id, device_id, notifying_id, send=True):
    logging.info('send_battery_notification_email %s, %s' %
                 (profile_id, device_id))
    notifying, rendered = _send_notification_templater(profile_id, device_id,
                                                       notifying_id,
                                                       'notification_email.html')

    if notifying is None:
        logging.info('BAIL CITY BABY, DONE EMAIL NOTIFIED ENUFF')
        return

    mail.send_mail(sender='FollowMyBattery Alert <support@followmybattery.com>',
                   to='%s <%s>' % (notifying.name, notifying.means),
                   subject='%s has a very sad phone =(' % notifying.name,
                   body=rendered)

    sent = models.NotificationSent(
        parent=notifying,
        means=notifying.means)
    sent.put()


def send_battery_notification_phone(profile_id, device_id, notifying_id, send=True):
    logging.info('send_battery_notification_phone %s, %s' %
                 (profile_id, device_id))
    notifying, rendered = _send_notification_templater(profile_id, device_id,
                                                       notifying_id,
                                                       'notification_phone.html')

    if notifying is None:
        logging.info('BAIL CITY BABY, DONE PHONE NOTIFIED ENUFF')
        return

    logging.info('rendered: %s' % rendered)
    twilio_message = None
    if send:
        client = TwilioRestClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        twilio_message = client.sms.messages.create(to=notifying.means,
                                                    from_="+15084525193",
                                                    body=rendered)

    sent = models.NotificationSent(
        parent=notifying,
        means=notifying.means)
    sent.put()

    logging.info('twilio twilio_message: %s, sent: %s' %
                 (twilio_message, sent.key().id()))


def send_battery_notifications(profile_id, device_id):
    """The deferred way to send battery notifications."""
    logging.info('send_battery_notifications %s, %s' %
                 (profile_id, device_id))
    profile = models.Profile.get_by_id(profile_id)
    device = models.Device.get_by_id(device_id, parent=profile)
    logging.info('send_battery_notifications %s, %s' %
                 (profile.username, device.uuid))

    q = db.Query(models.Notifying).ancestor(device.key())
    for notifying in q:
        logging.info('will defer %s %s' % (notifying.name, notifying.means))
        if notifying.type == 'phone':
            fn = send_battery_notification_phone

        elif notifying.type == 'email':
            fn = send_battery_notification_email

        else:
            logging.critical('Bad type for notifying: %s' % str(notifying.key()))
            continue

        deferred.defer(fn, profile_id, device_id,
                       notifying.key().id())


class ApiBatteryRequestHandler(ApiRequestHandler):
    def post(self, uuid=None):
        self.set_and_assert_profile()
        self.set_and_assert_device()

        level = self._json_request_data['level']
        is_this_update_over_notify_level = int(level) > int(self._device.notify_level)

        logging.info('YOOYO %s, %s' %
                     (self._device.is_last_update_over_notify_level,
                      is_this_update_over_notify_level))
        if (self._device.is_last_update_over_notify_level and
            not is_this_update_over_notify_level):
            logging.info('DO NOTIFICATIONS!')
            deferred.defer(send_battery_notifications,
                           self._profile.key().id(),
                           self._device.key().id())

        battery = models.Battery(
            parent=self._device,
            level=level,
            is_charging=self._json_request_data['is_charging']
        )
        battery.put()

        if is_this_update_over_notify_level != self._device.is_last_update_over_notify_level:
            self._device.is_last_update_over_notify_level = is_this_update_over_notify_level
            self._device.put()

        # Hack in is_last_update_over_notify_level
        json_output = models.to_dict(battery)
        json_output.update({
            'is_last_update_over_notify_level': is_this_update_over_notify_level
        })

        return self.output_json_success(json_output)


class ApiFollowingRequestHandler(ApiRequestHandler):
    def get(self, username=None):
        self.set_and_assert_profile()

        q = db.Query(models.Following).ancestor(self._profile.key())
        obj = {'following': []}
        for followed in q:
            followed_profile = followed.following
            logging.info('followed_profile: %s' % followed_profile.username)
            followed_obj = {
              'id': str(followed.key()),
              'profile': models.to_dict(followed_profile),
              'devices': []
            }
            q_device = db.Query(models.Device)
            q_device.ancestor(followed_profile.key())
            q_device.order('-created')

            for device in q_device:
                q_bat = db.Query(models.Battery)
                q_bat.ancestor(device.key())
                q_bat.order('-created')
                battery = q_bat.get()
                if battery is None:
                    battery_tpl_data = {}
                else:
                    battery_tpl_data = models.to_dict(battery)
                followed_device = {
                  'device': models.to_dict(device),
                  'battery': battery_tpl_data
                }
                followed_obj['devices'].append(followed_device)

            obj['following'].append(followed_obj)

        return self.output_json_success(obj)

    def post(self, username=None):
        self.set_and_assert_profile()
        username = self._json_request_data['username']
        q = db.Query(models.Profile).filter('username =', username)
        if q.count() == 0:
            return self.output_json_error()
        follow_profile = q.get()

        # Now make sure they're not already following that user.
        q = db.Query(models.Following).ancestor(self._profile.key())
        q.filter('following =', follow_profile.key())
        if q.count() > 0:
            logging.info('ALREADY following!')
            return self.output_json_error({'error': 'exists'}, 409)

        following = models.Following(
            parent=self._profile,
            following=follow_profile,
            parent_username=self._profile.username,
            following_username=follow_profile.username
        )
        following.put()
        return self.output_json_success(models.to_dict(follow_profile))


class ApiFollowingDeleteRequestHandler(ApiRequestHandler):
    def post(self, username=None):
        self.set_and_assert_profile()
        username = self._json_request_data['username']
        q = db.Query(models.Profile).filter('username =', username)
        if q.count() == 0:
            return self.output_json_error()
        follow_profile = q.get()

        q = db.Query(models.Following).ancestor(self._profile.key())
        q.filter('following =', follow_profile.key())

        if q.count() == 0:
            return self.output_json_error()

        follow_record = q.get()
        follow_record.delete()
        logging.info('Deleted follow_record!!')

        return self.output_json_success(models.to_dict(follow_profile))


class ApiNotifyingRequestHandler(ApiRequestHandler):
    def get(self, username=None):
        self.set_and_assert_profile()
        self.set_and_assert_device()

        q = db.Query(models.Notifying).ancestor(self._device.key())
        obj = {'notifying': []}
        for notifying in q:
            obj['notifying'].append(models.to_dict(notifying))

        return self.output_json_success(obj)

    def post(self, username=None):
        self.set_and_assert_profile()
        self.set_and_assert_device()

        # Now make sure they're not already following that user.
        q = db.Query(models.Notifying).ancestor(self._device.key())
        q.filter('means =', self._json_request_data['means'])
        if q.count() > 0:
            logging.info('ALREADY notifying!')
            return self.output_json_error({'error': 'exists'}, 409)

        notifying = models.Notifying(
            parent=self._device,
            parent_username=self._profile.username,
            means=self._json_request_data['means'],
            name=self._json_request_data['name'],
            type=self._json_request_data['type']
        )
        notifying.put()
        return self.output_json_success(models.to_dict(notifying))


class ApiNotifyingDeleteRequestHandler(ApiRequestHandler):
    def post(self, username=None):
        self.set_and_assert_profile()
        self.set_and_assert_device()

        # Now make sure they're not already following that user.
        q = db.Query(models.Notifying).ancestor(self._device.key())
        q.filter('means =', str(self._json_request_data['means']))

        if q.count() == 0:
            return self.output_json_error()

        notifying = q.get()
        notifying.delete()
        return self.output_json_success(models.to_dict(notifying))


class BatteryStatusRequestHandler(WebRequestHandler):
    """Looks up by username and display battery info."""
    def get(self, username=None):
        logging.info('BatteryStatusRequestHandler %s' % username)

        if username is None or username == '':
            return self.output_response({}, 'index.html')

        q = db.Query(models.Profile).filter('username =', username)
        if q.count() == 0:
            self.abort(404)
        profile = q.get()
        template_data = {
          'profile': models.to_dict(profile),
          'devices': []
        }
        q_device = db.Query(models.Device)
        q_device.ancestor(profile.key())
        q_device.order('-created')

        for device in q_device:
            q_bat = db.Query(models.Battery)
            q_bat.ancestor(device.key())
            q_bat.order('-created')
            battery = q_bat.get()
            device_data = {
              'device': models.to_dict(device),
              'battery': models.to_dict(battery)
            }
            template_data['devices'].append(device_data)

        template_data['title'] = template_data['profile']['username'] + \
            ' ' + str(template_data['devices'][0]['battery']['level']) + \
            '% - FollowMyBattery'

        logging.info('TPL_DATA %s' % template_data)
        self.output_response(template_data, 'battery_status.html')


app = webapp2.WSGIApplication([
    (r'/api/profile/(.*)', ApiProfileRequestHandler),
    (r'/api/device/(.*)', ApiDeviceRequestHandler),
    (r'/api/battery/(.*)', ApiBatteryRequestHandler),
    (r'/api/following/delete(.*)', ApiFollowingDeleteRequestHandler),
    (r'/api/following/(.*)', ApiFollowingRequestHandler),
    (r'/api/notifying/delete/(.*)', ApiNotifyingDeleteRequestHandler),
    (r'/api/notifying/(.*)', ApiNotifyingRequestHandler),
    (r'/(.*)', BatteryStatusRequestHandler),
    ], debug=True)
