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
from google.appengine.ext import deferred
from google.appengine.ext import ndb
sys.modules['ndb'] = ndb
from google.appengine.ext import deferred

from webapp2_extras import jinja2

from lib.web_request_handler import WebRequestHandler
from lib import models

from lib.external.twilio.rest import TwilioRestClient

# last import.
import settings


def api_token_required(handler_method):
    """A decorator to require that an API token is passed in."""
    def check_api_token(self, *args, **kwargs):
        api_token = self.request.get('api_token')
        assert api_token
        handler_method(self, *args, **kwargs)
    return check_api_token


class ApiRequestHandler(WebRequestHandler):
    def initialize(self, request, response):
        #logging.info('ApiRequestHandler initialize - %s %s' %
        #             (request.method, request.path))
        super(ApiRequestHandler, self).initialize(request, response)
        self._set_json_request_data()
        self._assert_user_key()
        self._assert_api_token()

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
                logging.info('Exception in _set_json_request_data - %s - %s',
                             str(e),
                             json_request)

        # THIS IS GHETTO dumping this data into the _json_request_data
        # Did this b/c the syntax to check _json_request_data for key
        # existence is also pretty ugly and these two fields are pretty key.
        elif self.request.method == 'GET':
            if self.request.get('api_token'):
                self._json_request_data['api_token'] = self.request.get('api_token')
            if self.request.get('user_key'):
                self._json_request_data['user_key'] = self.request.get('user_key')
            if self.request.get('device_key'):
                self._json_request_data['device_key'] = self.request.get('device_key')

        logging.info('JSON REQ DATA: %s' % self._json_request_data)

    @property
    def pruned_json_request_data(self):
        obj = self._json_request_data.copy()
        try:
            obj.pop('api_token')
            obj.pop('user_key')
            obj.pop('device_key')
        except KeyError:
            pass
        return obj

    def _assert_user_key(self):
        """Ensures that the passed in user_key data matches the logged in user.

        Admins could theoretically bypass this check to get data for other
        users.
        """
        if 'user_key' not in self._json_request_data:
            return
        assert self.current_user is not None
        #logging.info('_assert_user_id %s vs %s' %
        #    (self.current_user.key.urlsafe(), self._json_request_data['user_key']))
        assert self.current_user.key.urlsafe() == self._json_request_data['user_key']

    def _get_device_by_device_key(self):
        """Ensures that the passed in device_key is owned by current_user."""
        if 'device_key' not in self._json_request_data:
            return
        device_key_urlsafe = self._json_request_data['device_key']
        logging.info('device_key_urlsafe: %s' % device_key_urlsafe)
        device_key = ndb.Key(urlsafe=device_key_urlsafe)
        logging.info('device_key: %s' % device_key)
        device = device_key.get()
        logging.info('device: %s' % device)
        assert device
        assert device_key.parent().id() == self.current_user.key.id()
        return device

    def _assert_api_token(self):
        """Ensures an API token is passed for all but /api/user/token."""
        url = self.request.path
        if url != '/api/user/token':
            assert 'api_token' in self._json_request_data


    @webapp2.cached_property
    def current_user(self):
        user = super(ApiRequestHandler, self).current_user
        if user is not None:
            return user

        # For our api_token situation, which is special because we can't go
        # setting a cookie for our domain in both our JS client and Java client.
        if ('user_key' in self._json_request_data and
            'api_token' in self._json_request_data):
            user_key = self._json_request_data['user_key']
            api_token = self._json_request_data['api_token']
            user = ndb.Key(urlsafe=user_key).get()
            logging.info('CURRENT_USER: %s, %s' % (user.name, user))
            if user.api_token == api_token:
                return user

        return None

    # Backbone.js likes to use put for update, we call it POST.
    def put(self, *args):
        self.post(*args)

    def options(self, *args):
        self.output_json_success()

    def output_json(self, obj):
        self.apply_cors_headers()
        self.response.headers['Content-Type'] = 'application/json'
        json_out = models.FMBModel.json_dump(obj)
        logging.info('output_json: %s' % json_out)
        self.response.out.write(json_out)

    def output_json_success(self, obj={}):
        obj['status'] = 0
        self.output_json(obj)

    def output_json_error(self, obj={}, error_code=404):
        obj['status'] = 1
        self.response.set_status(error_code)
        self.output_json(obj)


class ApiUserHandler(ApiRequestHandler):
    def get(self):
        user = self.current_user
        if not user:
             return self.output_json_error({}, 404)
        return self.output_json_success(
            user.to_dict(include_api_token=True, include_device_notifying=True))


class ApiUserTokenHandler(ApiRequestHandler):
    """Returns some pretty important data back to the user."""
    def post(self):
        memcache_key = 'user_token-%s' % self._json_request_data['user_token']
        user_id = memcache.get(memcache_key)
        assert user_id
        logging.info('UserTokenHandler user_id: %s' % user_id)

        user = models.FMBUser.get_by_id(user_id)
        logging.info('ApiUserTokenHandler user: %s' % user)
        assert user

        # Ok, now clear the memcache token - it's only good once.
        memcache.delete(memcache_key)

        return self.output_json_success(
            user.to_dict(include_api_token=True, include_device_notifying=True))


class ApiDeviceHandler(ApiRequestHandler):
    def get(self):
        device = self._get_device_by_device_key()
        return self.output_json_success(device.to_dict())

    def post(self):
        q = models.Device.query(ancestor=self.current_user.key).filter(
            models.Device.uuid == self._json_request_data['uuid'])

        if q.count() == 0:
            device = models.Device(
                uuid=self._json_request_data['uuid'],
                parent=self.current_user.key
            )
        elif q.count() == 1:
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


class ApiDeviceDeleteHandler(ApiRequestHandler):
    def post(self):
        # Note we cannot use _get_device_by_device_key here because we will
        # also pass in the device_key that is the actor in this case.
        device_key = ndb.Key(urlsafe=self._json_request_data['key'])
        device = device_key.get()
        assert device_key.parent().id() == self.current_user.key.id()

        # TODO(elsigh): Perhaps we shouldn't really delete data. duh.
        # Note, we're leaving all the orphaned settings data hanging around but
        # we'll no longer know what kind of device its tied to.
        # We cannot just reassign the parent or assign it to None as it is
        # inherently part of the key structure.
        logging.info('Removing current_user from device %s' % device)
        device.key.delete()
        return self.output_json_success()


app_for_taskqueue = webapp2.WSGIApplication()

def _send_notification_templater(user_id, device_id, notifying_id, tpl_name):
    logging.info('_send_notification_templater %s, %s, %s' %
                 (user_id, device_id, tpl_name))

    user = models.FMBUser.get_by_id(user_id)
    assert user

    device = models.Device.get_by_id(device_id, parent=user.key)
    assert device

    notifying = models.Notifying.get_by_id(notifying_id, parent=device.key)
    assert notifying

    logging.info('send_battery_notification_phone %s, %s, %s' %
                 (user.name, device.uuid, notifying.means))

    # Make sure we haven't sent this means a notification in the last N hours.
    q = models.NotificationSent.query(ancestor=device.key)
    q = q.filter(models.NotificationSent.means == notifying.means)

    from_time = datetime.now() - timedelta(hours=12)
    q = q.filter(models.NotificationSent.created > from_time)

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

    mail.send_mail(sender='Levels Alert <elsigh@levelsapp.com>',
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
                                  settings.TWILIO_AUTH_TOKEN)
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
    user = models.FMBUser.get_by_id(user_id)
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

        deferred.defer(fn, user_id, device_id, notifying.key.id())


class ApiSettingsHandler(ApiRequestHandler):
    def post(self):
        device = self._get_device_by_device_key()
        battery_level = self._json_request_data['battery_level']
        is_this_update_over_notify_level = int(battery_level) > int(device.notify_level)

        logging.info('device.is_last_update_over_notify_level %s, '
                     'is_this_update_over_notify_level %s' %
                     (device.is_last_update_over_notify_level,
                      is_this_update_over_notify_level))
        if (device.is_last_update_over_notify_level and
            not is_this_update_over_notify_level):
            logging.info('^^^^ DO NOTIFICATIONS! ^^^^')
            deferred.defer(send_battery_notifications,
                           self.current_user.key.id(),
                           device.key.id())

        settings = models.Settings(
            parent=device.key
        )
        settings_data = self.pruned_json_request_data
        settings.populate(**settings_data)
        settings.put()

        if is_this_update_over_notify_level != device.is_last_update_over_notify_level:
            device.is_last_update_over_notify_level = is_this_update_over_notify_level
            device.put()

        # Hack in is_last_update_over_notify_level
        json_output = settings.to_dict()
        json_output.update({
            'is_last_update_over_notify_level': is_this_update_over_notify_level
        })

        return self.output_json_success(json_output)


class ApiFollowingHandler(ApiRequestHandler):
    def get(self):
        q = models.Following.query(ancestor=self.current_user.key)
        logging.info('ApiFollowingHandler following len: %s' % q.count())
        obj = {'following': []}
        for followed in q:
            followed_user = followed.following.get()
            logging.info('followed_user: %s %s' %
                         (followed_user.key.urlsafe(), followed_user.name))
            followed_user_dict = followed_user.to_dict(
                include_device_notifying=False)
            obj['following'].append(followed_user_dict)

        return self.output_json_success(obj)

    def post(self):
        follow_user = ndb.Key(urlsafe=self._json_request_data['following_user_key']).get()
        # Makes sure a user with that key exists in our app.
        if follow_user is None:
            return self.output_json_error()

        # Makes sure they're not already following that user.
        q = models.Following.query(ancestor=self.current_user.key)
        q = q.filter(models.Following.following == follow_user.key)
        if q.count() > 0:
            logging.info('ALREADY following!')
            return self.output_json_error({'error': 'exists'}, 409)

        following = models.Following(
            parent=self.current_user.key,
            cid=self._json_request_data['cid'],
            following=follow_user.key
        )
        following.put()

        # Includes the cid for this one here so the client can match up
        out_dict = follow_user.to_dict()
        out_dict.update({
            'cid': self._json_request_data['cid']
        })
        return self.output_json_success(out_dict)


class ApiFollowingDeleteHandler(ApiRequestHandler):
    def post(self):
        follow_user = ndb.Key(urlsafe=self._json_request_data['key']).get()
        if follow_user is None:
            return self.output_json_error()

        q = models.Following.query(ancestor=self.current_user.key)
        q = q.filter(models.Following.following == follow_user.key)

        if q.count() == 0:
            return self.output_json_error()

        follow_record = q.get()
        follow_record.key.delete()
        logging.info('Deleted follow_record!!')
        return self.output_json_success(follow_user.to_dict())


class ApiNotifyingHandler(ApiRequestHandler):
    def get(self):
        device = self._get_device_by_device_key()
        q = models.Notifying.query(ancestor=device.key)
        obj = {'notifying': []}
        for notifying in q:
            obj['notifying'].append(notifying.to_dict())

        return self.output_json_success(obj)

    def post(self):
        device = self._get_device_by_device_key()
        # Now make sure they're not already following that user.
        q = models.Notifying.query(ancestor=device.key)
        q = q.filter(models.Notifying.means == self._json_request_data['means'])
        if q.count() > 0:
            logging.info('ALREADY notifying %s!' %
                         self._json_request_data['means'])
            return self.output_json_error({'error': 'exists'}, 409)

        notifying = models.Notifying(
            parent=device.key,
            cid=self._json_request_data['cid'],
            means=self._json_request_data['means'],
            name=self._json_request_data['name'],
            type=self._json_request_data['type']
        )
        notifying.put()
        return self.output_json_success(notifying.to_dict())


class ApiNotifyingDeleteHandler(ApiRequestHandler):
    def post(self):
        device = self._get_device_by_device_key()
        notifying = ndb.Key(urlsafe=self._json_request_data['key']).get()

        if notifying is None:
            return self.output_json_error()

        notifying.key.delete()
        return self.output_json_success(notifying.to_dict())
