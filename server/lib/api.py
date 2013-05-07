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

sys.path.append(os.path.join(os.path.dirname(__file__), 'external'))

from google.appengine.api import mail
from google.appengine.api import memcache
from google.appengine.ext import ndb
sys.modules['ndb'] = ndb
from google.appengine.ext import deferred

from webapp2_extras import jinja2
from webapp2_extras.appengine.auth.models import User

from lib.web_request_handler import WebRequestHandler
from lib import models

from lib.external.twilio.rest import TwilioRestClient

# last import.
import settings


def requires_api_token(func):
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
            if self.request.get('api_token'):
                self._json_request_data['api_token'] = self.request.get('api_token')
            if self.request.get('device_uuid'):
                self._json_request_data['device_uuid'] = self.request.get('device_uuid')

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

        # fixes a datetime encoding issue.
        date_handler = lambda obj: obj.isoformat() if isinstance(obj, datetime) else None
        json_out = json.dumps(obj, default=date_handler)

        self.response.out.write(json_out)

    def output_json_success(self, obj={}):
        obj['status'] = 0
        self.output_json(obj)

    def output_json_error(self, obj={}, error_code=404):
        obj['status'] = 1
        self.response.set_status(error_code)
        self.output_json(obj)

    def assert_current_user_with_api_token(self):
        api_token = self._json_request_data['api_token']
        assert api_token
        assert self.current_user.api_token == api_token

    def set_and_assert_device(self):
        device_uuid = self._json_request_data['device_uuid']
        q = models.Device.query(
            ancestor=self.current_user.key
        )
        q.filter(models.Device.uuid == device_uuid)
        device = q.get()
        assert device
        self._device = device


class ApiUserHandler(ApiRequestHandler):
    def get(self):
        user = ndb.Key(urlsafe=self._json_request_data['user_key']).get()
        if not user:
             return self.output_json_error({}, 404)
        return self.output_json_success(user.to_dict())

    # TODO(elsigh): Update User.name, etc..
    #def post(self, user_key=None):



class ApiUserTokenHandler(ApiRequestHandler):
    def post(self):
        user_id = memcache.get('user_token-%s' %
                               self._json_request_data['user_token'])
        logging.info('user_id :: %s' % user_id)
        assert user_id
        user = ndb.Key('User', int(user_id)).get()
        return self.output_json_success(user.to_dict())


class ApiDeviceHandler(ApiRequestHandler):
    def get(self, device_uuid=None):
        self.set_and_assert_device()
        return self.output_json_success(self._device.to_dict())

    def post(self):
        self.assert_current_user_with_api_token()

        q = models.Device.query().filter(
            models.Device.uuid == self._json_request_data['device_uuid'])
        if q.count() == 0:
            device = models.Device(
                uuid=self._json_request_data['device_uuid'],
                parent=self.current_user.key
            )
        else:
            device = q.get()

        device.user_agent_string = self._json_request_data['user_agent_string']
        device.update_enabled = int(self._json_request_data['update_enabled'])
        device.update_frequency = int(self._json_request_data['update_frequency'])
        if 'notify_level' in self._json_request_data:
            device.notify_level = int(self._json_request_data['notify_level'])
        device.name = self._json_request_data['name']
        device.platform = self._json_request_data['platform']
        device.version = self._json_request_data['version']
        device.put()

        return self.output_json_success(device.to_dict())


app_for_taskqueue = webapp2.WSGIApplication()

def _send_notification_templater(user_id, device_id, notifying_id, tpl_name):

    logging.info('_send_notification_templater %s, %s, %s' %
                 (user_id, device_id, tpl_name))
    user = models.User.get_by_id(user_id)
    device = models.Device.get_by_id(device_id, parent=user.key)
    notifying = models.Notifying.get_by_id(notifying_id, parent=device.key)
    logging.info('send_battery_notification_phone %s, %s, %s' %
                 (user.name, device.uuid, notifying.means))

    # Make sure we haven't sent this means a notification in the last N hours.
    q = models.NotificationSent.query(ancestor=device.key)
    q.filter(models.NotificationSent.means == notifying.means)

    from_time = datetime.now() - timedelta(hours=12)
    q.filter(models.NotificationSent.created > from_time)

    if q.count() != 0:
        logging.info('Nope, we already sent them a notification recently.')
        return None, None

    tpl_data = {
        'user': user.to_dict(),
        'device': device.to_dict(),
        'notifying': notifying.to_dict()
    }

    rendered = jinja2.get_jinja2(app=app_for_taskqueue).render_template(tpl_name, **tpl_data)
    return notifying, rendered


def send_battery_notification_email(user_id, device_id, notifying_id, send=True):
    logging.info('send_battery_notification_email %s, %s' %
                 (user_id, device_id))
    notifying, rendered = _send_notification_templater(user_id, device_id,
                                                       notifying_id,
                                                       'notification_email.html')

    if notifying is None:
        logging.info('BAIL CITY BABY, DONE EMAIL NOTIFIED ENUFF')
        return

    mail.send_mail(sender='FollowMyBattery Alert <elsigh@followmybattery.com>',
                   to='%s <%s>' % (notifying.name, notifying.means),
                   subject='%s has a very sad phone =(' % notifying.name,
                   body=rendered)

    sent = models.NotificationSent(
        parent=notifying.key,
        means=notifying.means)
    sent.put()


def send_battery_notification_phone(user_id, device_id, notifying_id, send=True):
    logging.info('send_battery_notification_phone %s, %s' %
                 (user_id, device_id))
    notifying, rendered = _send_notification_templater(user_id, device_id,
                                                       notifying_id,
                                                       'notification_phone.html')

    if notifying is None:
        logging.info('BAIL CITY BABY, DONE PHONE NOTIFIED ENUFF')
        return

    logging.info('rendered: %s' % rendered)
    twilio_message = None
    if send:
        client = TwilioRestClient(settings.TWILIO_ACCOUNT_SID,
                                  settings.TWILIO_api_token)
        twilio_message = client.sms.messages.create(to=notifying.means,
                                                    from_="+15084525193",
                                                    body=rendered)

    sent = models.NotificationSent(
        parent=notifying.key,
        means=notifying.means
    )
    sent.put()

    logging.info('twilio twilio_message: %s, sent: %s' %
                 (twilio_message, sent.key.id()))


def send_battery_notifications(user_id, device_id):
    """The deferred way to send battery notifications."""
    logging.info('send_battery_notifications %s, %s' %
                 (user_id, device_id))
    user = models.User.get_by_id(user_id)
    device = models.Device.get_by_id(device_id, parent=user.key)
    logging.info('send_battery_notifications %s, %s' %
                 (user.name, device.uuid))

    q = models.Notifying.query(ancestor=device.key)
    for notifying in q:
        logging.info('will defer %s %s' % (notifying.name, notifying.means))
        if notifying.type == 'phone':
            fn = send_battery_notification_phone

        elif notifying.type == 'email':
            fn = send_battery_notification_email

        else:
            logging.critical('Bad type for notifying: %s' % str(notifying.key))
            continue

        deferred.defer(fn, user_id, device_id,
                       notifying.key.id())


class ApiSettingsHandler(ApiRequestHandler):
    def post(self):
        self.assert_current_user_with_api_token()
        self.set_and_assert_device()

        battery_level = self._json_request_data['battery_level']
        is_this_update_over_notify_level = int(battery_level) > int(self._device.notify_level)

        logging.info('_device.is_last_update_over_notify_level %s, '
                     'is_this_update_over_notify_level %s' %
                     (self._device.is_last_update_over_notify_level,
                      is_this_update_over_notify_level))
        if (self._device.is_last_update_over_notify_level and
            not is_this_update_over_notify_level):
            logging.info('^^^^ DO NOTIFICATIONS! ^^^^')
            deferred.defer(send_battery_notifications,
                           self.current_user.key.id(),
                           self._device.key.id())

        settings = models.Settings(
            parent=self._device.key,
            battery_level=battery_level,
            is_charging=self._json_request_data['is_charging']
        )
        settings.put()

        if is_this_update_over_notify_level != self._device.is_last_update_over_notify_level:
            self._device.is_last_update_over_notify_level = is_this_update_over_notify_level
            self._device.put()

        # Hack in is_last_update_over_notify_level
        json_output = settings.to_dict()
        json_output.update({
            'is_last_update_over_notify_level': is_this_update_over_notify_level
        })

        return self.output_json_success(json_output)


class ApiFollowingHandler(ApiRequestHandler):
    def get(self):
        self.assert_current_user_with_api_token()

        q = models.Following.query(ancestor=self.current_user.key)
        obj = {'following': []}
        for followed in q:
            followed_user = followed.following.get()
            logging.info('followed_user: %s' % followed_user.name)
            followed_obj = {
              'user': followed_user.to_dict(),
              'devices': []
            }
            q_device = models.Device.query(ancestor=followed_user.key)
            q_device.order(-models.Device.created)

            for device in q_device:
                q_settings = models.Settings.query(ancestor=device.key)
                q_settings.order(-models.Settings.created)
                settings = q_settings.get()
                if settings is None:
                    settings_tpl_data = {}
                else:
                    settings_tpl_data = settings.to_dict()
                followed_device = {
                  'device': device.to_dict(),
                  'settings': settings_tpl_data
                }
                followed_obj['devices'].append(followed_device)

            obj['following'].append(followed_obj)

        return self.output_json_success(obj)

    def post(self):
        self.assert_current_user_with_api_token()
        follow_user = ndb.Key(urlsafe=self._json_request_data['user_key']).get()
        if follow_user is None:
            return self.output_json_error()

        # Now make sure they're not already following that user.
        q = models.Following.query(ancestor=self.current_user.key)
        q.filter(models.Following.following == follow_user.key)
        if q.count() > 0:
            logging.info('ALREADY following!')
            return self.output_json_error({'error': 'exists'}, 409)

        following = models.Following(
            parent=self.current_user.key,
            following=follow_user.key
        )
        following.put()
        return self.output_json_success(follow_user.to_dict())


class ApiFollowingDeleteHandler(ApiRequestHandler):
    def post(self):
        self.assert_current_user_with_api_token()

        follow_user = ndb.Key(urlsafe=self._json_request_data['user_key']).get()
        if follow_user is None:
            return self.output_json_error()

        q = models.Following.query(ancestor=self.current_user.key)
        q.filter(models.Following.following == follow_user.key)

        if q.count() == 0:
            return self.output_json_error()

        follow_record = q.get()
        follow_record.key.delete()
        logging.info('Deleted follow_record!!')

        return self.output_json_success(follow_user.to_dict())


class ApiNotifyingHandler(ApiRequestHandler):
    def get(self):
        self.assert_current_user_with_api_token()
        self.set_and_assert_device()
        # TODO(elsigh): assert user owns device_key

        q = models.Notifying.query(ancestor=self._device.key)
        obj = {'notifying': []}
        for notifying in q:
            obj['notifying'].append(notifying.to_dict())

        return self.output_json_success(obj)

    def post(self):
        self.assert_current_user_with_api_token()
        self.set_and_assert_device()
        # TODO(elsigh): assert user owns device_key

        # Now make sure they're not already following that user.
        q = models.Notifying.query(ancestor=self._device.key)
        q.filter(models.Notifying.means == self._json_request_data['means'])
        if q.count() > 0:
            logging.info('ALREADY notifying!')
            return self.output_json_error({'error': 'exists'}, 409)

        notifying = models.Notifying(
            parent=self._device.key,
            means=self._json_request_data['means'],
            name=self._json_request_data['name'],
            type=self._json_request_data['type']
        )
        notifying.put()
        return self.output_json_success(notifying.to_dict())


class ApiNotifyingDeleteHandler(ApiRequestHandler):
    def post(self, device_key=None):
        self.assert_current_user_with_api_token()
        self.set_and_assert_device()
        # TODO(elsigh): assert user owns device_key

        # Now make sure they're not already following that user.
        q = models.Notifying.query(ancestor=device_key)
        q.filter(models.Notifying.means == self._json_request_data['means'])

        if q.count() == 0:
            return self.output_json_error()

        notifying = q.get()
        notifying.key.delete()
        return self.output_json_success(notifying.to_dict())
