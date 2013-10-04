# -*- coding: utf-8 -*-
import datetime
import httplib2
import json
import logging
import settings
import time
import uuid

from google.appengine.api import memcache
from google.appengine.api import urlfetch
from google.appengine.ext import deferred

from lib.web_request_handler import WebRequestHandler

from lib.external.simpleauth import SimpleAuthHandler
from lib.external.apiclient import discovery
from lib.external.oauth2client.client import OAuth2Credentials
from lib.external.oauth2client.client import credentials_from_code

from lib import models


def login_required(handler_method):
    '''A decorator to require that a user be logged in to access a handler.
    To use it, decorate your get() method like this:
        @login_required
        def get(self):
            user = self.current_user
            self.response.out.write('Hello, ' + user.name())
    '''
    def check_login(self, *args, **kwargs):
        if self.request.method != 'GET':
            self.abort(400, detail='The login_required decorator '
                'can only be used for GET requests.')

        # Makes sure the user is signed in and that we have an
        # oauth2_refresh_token.
        if ((self.current_user and
             hasattr(self.current_user, 'oauth2_refresh_token') and
             self.current_user.oauth2_refresh_token)):
            handler_method(self, *args, **kwargs)
        else:
            self.session['continue_path'] = self.request.path
            self.redirect('/auth/google')

    return check_login


class LoginHandler(WebRequestHandler):
    def get(self):
        '''Handles default landing page.'''

        user_token = self.request.get('user_token', None)
        if user_token is not None:
            self.session['user_token'] = user_token

        continue_path = self.request.get('continue_path', None)
        self.session['continue_path'] = continue_path

        # Only Google for now, otherwise, one day, checkout login.html
        self.redirect('/auth/google')


class AuthHandler(WebRequestHandler, SimpleAuthHandler):
    '''Authentication handler for OAuth 2.0, 1.0(a) and OpenID.'''

    # Enable optional OAuth 2.0 CSRF guard
    OAUTH2_CSRF_STATE = True

    USER_ATTRS = {
        'google': {
            'picture': 'avatar_url',
            'name': 'name',
            'family_name': 'family_name',
            'given_name': 'given_name',
            'link': 'link',
            'email': 'email'
        }
    }

    # This is to override the implemnentation of plus.login's me scope.
    def _get_google_user_info(self, auth_info, key=None, secret=None):
        """Returns a dict of currenly logging in user using discovery svc."""

        logging.info('_get_google_user_info auth_info: %s' % auth_info)

        expires_datetime = None
        if 'expires_in' in auth_info:
            oauth2_token_expires_in = auth_info['expires_in']
            time_expires = int(time.time()) + oauth2_token_expires_in
            expires_datetime = datetime.datetime.utcfromtimestamp(time_expires)

        credentials = OAuth2Credentials(
            auth_info['access_token'],
            settings.GOOGLE_APP_ID,
            settings.GOOGLE_APP_SECRET,
            auth_info['refresh_token'],
            expires_datetime,
            token_uri='https://accounts.google.com/o/oauth2/token',
            user_agent=settings.USER_AGENT)

        # And now make a request to get the user's name info.
        http = httplib2.Http()
        credentials.authorize(http)
        service = discovery.build('plus', 'v1', http=http)
        me = service.people().get(userId='me').execute()
        logging.info('GOT me: %s' % me)

        # Now get userinfo, so we can email - so sad.
        resp = self._oauth2_request(
            'https://www.googleapis.com/oauth2/v3/userinfo?{0}',
            auth_info['access_token']
        )
        userinfo = json.loads(resp)
        logging.info('GOT userinfo: %s' % userinfo)

        family_name = ''
        given_name = ''
        if 'name' in me:
            family_name = me['name']['familyName']
            given_name = me['name']['givenName']

        user_data = {
            'id': me['id'],
            'picture': me['image']['url'],
            'name': me['displayName'],
            'family_name': family_name,
            'given_name': given_name,
            'link': me['url'],
            'email': userinfo['email']
        }
        return user_data

    def _google_code_exchange(self):
        self.set_json_request_data()
        code = self.request.get('code', self._json_request_data['code'])
        logging.info('_google_code_exchange CODE: %s' % code)
        assert code

        # Sets our identifying bit for the client to do it's subsequent
        # fetch flow with - It was called back with this code.
        self.session['user_token'] = code

        # Turn access code into Credentials.
        credentials = credentials_from_code(
            client_id=settings.GOOGLE_APP_ID,
            client_secret=settings.GOOGLE_APP_SECRET,
            scope='',
            code=code,
            redirect_uri='')
        logging.info('GOT credentials.id_token: %s' % credentials.id_token)

        # And now make a request to get the user's name info.
        http = httplib2.Http()
        credentials.authorize(http)
        service = discovery.build('plus', 'v1', http=http)
        me = service.people().get(userId='me').execute()
        logging.info('GOT me: %s' % me)

        family_name = ''
        given_name = ''
        if 'name' in me:
            family_name = me['name']['familyName']
            given_name = me['name']['givenName']

        user_data = {
            'id': me['id'],
            'picture': me['image']['url'],
            'name': me['displayName'],
            'family_name': family_name,
            'given_name': given_name,
            'link': me['url'],
            'email': credentials.id_token['email']
        }

        auth_info = {
            'access_token': credentials.access_token,
            'refresh_token': credentials.refresh_token,
            'expires_datetime': credentials.token_expiry
        }

        self._on_signin(user_data, auth_info, 'google', redirect=False)

    def _on_signin(self, data, auth_info, provider, redirect=True):
        '''Callback whenever a new or existing user is logging in.
         data is a user info dictionary.
         auth_info contains access token or oauth token and secret.
        '''
        logging.info('_on_signin callback w/ %s, %s, %s' %
                     (data, auth_info, provider))

        auth_id = '%s:%s' % (provider, data['id'])
        logging.info('Looking for a user with id %s', auth_id)
        user = self.auth.store.user_model.get_by_auth_id(auth_id)

        _attrs = self._to_user_model_attrs(data, self.USER_ATTRS[provider])

        # Update _attrs to include oauth2 token / info.
        expires_datetime = None
        if 'expires_in' in auth_info:
            oauth2_token_expires_in = auth_info['expires_in']
            time_expires = int(time.time()) + oauth2_token_expires_in
            expires_datetime = datetime.datetime.utcfromtimestamp(time_expires)
        elif 'expires_datetime' in auth_info:
            expires_datetime = auth_info['expires_datetime']
        _attrs.update({
            'oauth2_access_token': auth_info['access_token'],
            'oauth2_refresh_token': auth_info.get('refresh_token', None),
            'oauth2_expires_datetime': expires_datetime
        })

        if user is not None:
            logging.info('Found existing user to log in')
            user.populate(**_attrs)
            user.put()
            self.auth.set_session(
                self.auth.store.user_to_dict(user))

        else:
            # check whether there's a user currently logged in
            # then, create a new user if nobody's signed in,
            # otherwise add this auth_id to currently logged in user.

            if self.current_user:
                logging.info('Updating a currently logged in user!')

                user = self.current_user
                user.populate(**_attrs)
                # The following will also do put(). Though, in a real app
                # you might want to check the result, which is
                # (boolean, info) tuple where boolean == True indicates success
                # See webapp2_extras.appengine.auth.models.User for details.
                user.add_auth_id(auth_id)

            else:
                logging.info('Creating a brand new user!')

                ok, user = self.auth.store.user_model.create_user(auth_id,
                                                                  **_attrs)
                if ok:
                    self.auth.set_session(self.auth.store.user_to_dict(user))

        # For the native app auth flow we don't want to redirect, just return.
        if redirect is False:
            logging.info('OK, no redirect needed, returning the user model')
            user_dict = user.to_dict(include_api_token=True,
                                     include_device_notifying=True)
            logging.info('got user_dict, now outputting...')
            return self.output_json_success(user_dict)

        # Ok, time to move on.
        # If login was invoked via our login_required decorator we will have
        # continue_path set to something.
        # If login was invoked directly via '/login' we won't in which case
        # we will just go to the user's profile.
        # Lastly we might have called via '/login?continue_path=something'
        # in which case we'll redirect to something.
        redirect_url = self.session.get('continue_path', None)
        self.session['continue_path'] = None  # unset for the future

        # Stores a key / val pair in memcache for the client to query on
        # to match up the user id to the user_token.
        user_token = self.session.get('user_token', None)
        logging.info('_on_signin session user_token: %s' % user_token)
        if user_token is not None:
            self.session['user_token'] = None  # unset for the future
            memcache.add('user_token-%s' % user_token, user.key.id(), 60)
            logging.info('Added user_token<->user.key.id match - %s, %s' %
                         (user_token, user.key.id()))

        if redirect_url is None:
            redirect_url = '/p/%s' % user.unique_profile_str
            if user_token is not None:
                redirect_url += '?close=1'

        logging.info('OK, we are logged in, redirect_url: %s' % redirect_url)
        self.redirect(redirect_url)

    def logout(self):
        self.auth.unset_session()
        self.redirect(self.request.get('continue', '/login?r=0'))

    def _callback_uri_for(self, provider):
        return self.uri_for('auth_callback', provider=provider, _full=True)

    def _get_consumer_info_for(self, provider):
        return settings.AUTH_CONFIG[provider]

    def _to_user_model_attrs(self, data, attrs_map):
        '''Get the needed information from the provider dataset.'''
        user_attrs = {}
        for k, v in attrs_map.iteritems():
            attr = (v, data.get(k)) if isinstance(v, str) else v(data.get(k))
            user_attrs.setdefault(*attr)

        return user_attrs
