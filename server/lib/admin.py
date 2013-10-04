#!/usr/bin/python2.7
#


import json
import logging
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), 'external'))

from lib.web_request_handler import WebRequestHandler
from lib.external.simpleauth import SimpleAuthHandler

from google.appengine.api import users
from google.appengine.ext import ndb
sys.modules['ndb'] = ndb
from google.appengine.datastore.datastore_query import Cursor

from webapp2_extras.appengine.users import admin_required

from lib import models
from lib.auth import login_required


class AdminTinkerHandler(WebRequestHandler, SimpleAuthHandler):
    @admin_required
    @login_required
    def get(self):
        user_info = self._get_google_user_info({
            'access_token': self.current_user.oauth2_access_token
        })
        self.output_response({
            'title': 'Levels Admin: Tinker',
            'user_info': user_info

        }, 'admin_tinker.html')


class AdminApiHandler(WebRequestHandler):
    @admin_required
    def get(self):
        self.output_response({
            'title': 'Levels Admin: API Request'
        }, 'admin_api_request.html')


class AdminUsersHandler(WebRequestHandler):
    @admin_required
    def get(self):
        curs = Cursor(urlsafe=self.request.get('cursor'))
        users_list, next_curs, more = models.FMBUser.query().order(
            -models.FMBUser.created).fetch_page(10, start_cursor=curs)
        users_output = []
        for user in users_list:
            users_output.append(user.to_dict())
        tpl_data = {
            'title': 'Levels Admin: Users',
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
        logging.info('user_id: %s', user_id)
        logging.info('extras: %s', extras)
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
