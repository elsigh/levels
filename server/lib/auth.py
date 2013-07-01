# -*- coding: utf-8 -*-
import datetime
import logging
import settings
import time
import uuid

from google.appengine.api import memcache
from google.appengine.ext import deferred

from lib.web_request_handler import WebRequestHandler
from lib.external.simpleauth import SimpleAuthHandler

from lib import models


def login_required(handler_method):
    """A decorator to require that a user be logged in to access a handler.
    To use it, decorate your get() method like this:
        @login_required
        def get(self):
            user = self.current_user
            self.response.out.write('Hello, ' + user.name())
    """
    def check_login(self, *args, **kwargs):
        if self.request.method != 'GET':
            self.abort(400, detail='The login_required decorator '
                'can only be used for GET requests.')

        if self.current_user:
            handler_method(self, *args, **kwargs)
        else:
            self.session['original_url'] = self.request.url
            self.redirect('/auth/google')

    return check_login


class LoginHandler(WebRequestHandler):
    def get(self):
        """Handles default landing page"""

        user_token = self.request.get('user_token', None)
        if user_token is not None:
            self.session['user_token'] = user_token

        if self.current_user:
            # See the simpleauth_login_required decorator for original_url
            original_url = self.session.get('original_url', None)
            if original_url is not None:
                self.session['original_url'] = None
                self.redirect(original_url)

            uri = '/p/%s' % self.current_user.unique_profile_str

            if user_token is not None:
                memcache.set('user_token-%s' % user_token,
                             self.current_user.key.id(), 60)
                logging.info('Set user_token<->id match - %s, %s' %
                             (user_token, self.current_user.key.id()))
                uri = uri + '?close=1'

            self.redirect(uri)

        # aka no redirect, let the user choose a login provider.
        elif self.request.get('r') == '0':
            self.output_response({}, 'login.html')

        else:
            self.redirect('/auth/google')


class AuthHandler(WebRequestHandler, SimpleAuthHandler):
    """Authentication handler for OAuth 2.0, 1.0(a) and OpenID."""

    # Enable optional OAuth 2.0 CSRF guard
    OAUTH2_CSRF_STATE = True

    USER_ATTRS = {
        'google'   : {
            'picture': 'avatar_url',
            'name'   : 'name',
            'family_name': 'family_name',
            'given_name': 'given_name',
            'link'   : 'link',
            'email'  : 'email'
        }
    }

    def _on_signin(self, data, auth_info, provider):
        """Callback whenever a new or existing user is logging in.
         data is a user info dictionary.
         auth_info contains access token or oauth token and secret.
        """
        logging.info('_on_signin callback w/ %s, %s, %s' %
                     (data, auth_info, provider))

        auth_id = '%s:%s' % (provider, data['id'])
        logging.info('Looking for a user with id %s', auth_id)
        user = self.auth.store.user_model.get_by_auth_id(auth_id)

        _attrs = self._to_user_model_attrs(data, self.USER_ATTRS[provider])

        # Update _attrs to include oauth2 token / info.
        oauth2_token_expires_in = auth_info['expires_in']
        time_expires = int(time.time()) + oauth2_token_expires_in
        expires_datetime = datetime.datetime.utcfromtimestamp(time_expires)
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
                logging.info('Updating currently logged in user')

                u = self.current_user
                u.populate(**_attrs)
                # The following will also do u.put(). Though, in a real app
                # you might want to check the result, which is
                # (boolean, info) tuple where boolean == True indicates success
                # See webapp2_extras.appengine.auth.models.User for details.
                u.add_auth_id(auth_id)

            else:
                logging.info('Creating a brand new user')

                ok, user = self.auth.store.user_model.create_user(auth_id,
                                                                  **_attrs)
                if ok:
                    self.auth.set_session(self.auth.store.user_to_dict(user))

        logging.info('USER to_dict AFTER create_user: %s' % user.to_dict())
        profile_url = '/p/%s' % user.unique_profile_str

        # Stores a key / val pair in memcache for the client to query on
        # to match up the user id to the user_token.
        user_token = self.session.get('user_token')
        logging.info('_on_signin session user_token: %s' % user_token)
        if user_token:
            memcache.add('user_token-%s' % user_token, user.key.id(), 60)
            logging.info('Added user_token<->id match - %s, %s' %
                         (user_token, user.key.id()))
            self.session['user_token'] = None
            profile_url += '?close=1'

        # Go to the profile page.
        self.redirect(profile_url)

    def logout(self):
        self.auth.unset_session()
        self.redirect(self.request.get('continue', '/login?r=0'))

    def _callback_uri_for(self, provider):
        return self.uri_for('auth_callback', provider=provider, _full=True)

    def _get_consumer_info_for(self, provider):
        """Returns a tuple (key, secret) for auth init requests."""
        return settings.AUTH_CONFIG[provider]

    def _to_user_model_attrs(self, data, attrs_map):
        """Get the needed information from the provider dataset."""
        user_attrs = {}
        for k, v in attrs_map.iteritems():
            attr = (v, data.get(k)) if isinstance(v, str) else v(data.get(k))
            user_attrs.setdefault(*attr)

        return user_attrs
