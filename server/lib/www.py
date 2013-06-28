#!/usr/bin/python2.7
#


import datetime
import json
import logging
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), 'external'))

from lib.web_request_handler import WebRequestHandler

from google.appengine.api import users
from google.appengine.ext import ndb
sys.modules['ndb'] = ndb
from google.appengine.datastore.datastore_query import Cursor

import webapp2
from webapp2_extras.appengine.users import admin_required

from lib import models

# last import.
import settings


class AdminApiRequestHandler(WebRequestHandler):
    @admin_required
    def get(self):
        self.output_response({
            'title': 'Levels[Admin]: API Request'
        }, 'admin_api_request.html')


class AdminUsersHandler(WebRequestHandler):
    @admin_required
    def get(self):
        curs = Cursor(urlsafe=self.request.get('cursor'))
        users, next_curs, more = models.FMBUser.query().order(
            -models.FMBUser.created).fetch_page(10, start_cursor=curs)
        users_output = []
        for user in users:
            users_output.append(user.to_dict())
        tpl_data = {
            'title': 'Levels[Admin]: Users',
            'users': users_output,
            'next_cursor': next_curs.urlsafe(),
            'more': more
        }
        self.output_response(tpl_data, 'admin_users.html')


class AdminUserMessageTestHandler(WebRequestHandler):
    @admin_required
    def get(self):
        self.output_response({'result': 'not yet'},
                             'admin_user_message_test.html')

    def post(self):
        # Admin USER override by JSON request value.
        gae_user = users.get_current_user()
        if gae_user is None or not users.is_current_user_admin():
            self.abort(403)

        user_id = self.request.get('user_id')
        extras = self.request.get('extras')
        if extras is not None:
            extras = json.loads(extras)
        else:
            extras = {}

        message = self.request.get('message', 'Test message')
        result = False

        if user_id:
            user = models.FMBUser.get_by_id(int(user_id))
            if user:
                result = user.send_message(message, extra=extras)

        self.output_response({'result': result},
                             'admin_user_message_test.html')


class AppHandler(WebRequestHandler):
    def get(self, endpoint=None):
        app_html = open('templates/app.html', 'r').read()
        self.response.out.write(app_html)


class ProfileHandler(WebRequestHandler):
    def get(self, unique_profile_str=None):
        """Handles GET /profile"""

        if unique_profile_str is None:
            self.abort(404)

        # "close" will be set when a user is logging in through the
        # installed Android or iOS app.
        close = self.request.get('close')

        user = None

        # If you're logged in ...
        if self.current_user:
            # Maybe it's all about you.
            if ((self.current_user.unique_profile_str ==
                 unique_profile_str)):
                user = self.current_user

            # If you're not in the OAuth2 login flow in via the mobile app,
            # let's take ya to the web app.
            if close is None:
                if user:
                    return self.redirect('/app')
                else:
                    return self.redirect('/app/follow/%s' % unique_profile_str)

        if user is None:
            q = models.FMBUser.query().filter(
                ndb.GenericProperty('unique_profile_str') ==
                unique_profile_str)
            user = q.get()

            if user is None:
                self.abort(404)

        logging.info('Profile user!: %s', user.to_dict())
        template_data = {
            'user': user.to_dict(),
            'user_json': user.to_json(),
            'session': self.auth.get_user_by_session(),
            'close': close,
        }

        # TODO(elsigh): Allow user to set "default" device or
        # sort order devices one day.
        template_data['title'] = template_data['user']['name']
        if (('devices' in template_data['user'] and
             len(template_data['user']['devices']))):
            first_device = template_data['user']['devices'][0]
            if (('settings' in first_device and
                 len(first_device['settings']))):
                most_recent_setting = first_device['settings'][0]
                template_data['title'] += (
                    ' - ' +
                    str(most_recent_setting['battery_level']) + '%')

        template_data['title'] += ' - Levels'

        self.output_response(template_data, 'profile.html')


class SupportHandler(WebRequestHandler):
    def get(self):
        self.output_response({
            'title': 'Levels - Support'
        }, 'support.html')


class IndexHandler(WebRequestHandler):
    def get(self):
        self.output_response({
            'title': 'Levels App'
        }, 'index.html')
