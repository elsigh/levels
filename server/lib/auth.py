# -*- coding: utf-8 -*-
import logging
import settings
import uuid

from google.appengine.api import memcache
from google.appengine.ext import deferred

from lib.web_request_handler import WebRequestHandler
from lib.external.simpleauth import SimpleAuthHandler

from lib import models


class LoginHandler(WebRequestHandler):
  def get(self):
    """Handles default landing page"""
    user_token = self.request.get('user_token')
    self.session['user_token'] = user_token
    tpl_data = {}
    if self.current_user:
      memcache.set('user_token-%s' % user_token, self.current_user.key.id(), 60)
      logging.info('Set user_token<->id match - %s, %s' %
                   (user_token, self.current_user.key.id()))
      uri = '/p/%s' % self.current_user.unique_profile_str
      if user_token:
        uri = uri + '?close=1'
      self.redirect(uri)
    elif self.request.get('r') == '0':
      self.output_response(tpl_data, 'login.html')
    else:
      self.redirect('/auth/google')


class AuthHandler(WebRequestHandler, SimpleAuthHandler):
  """Authentication handler for OAuth 2.0, 1.0(a) and OpenID."""

  # Enable optional OAuth 2.0 CSRF guard
  OAUTH2_CSRF_STATE = True

  USER_ATTRS = {
    'facebook' : {
      'id'     : lambda id: ('avatar_url',
        'http://graph.facebook.com/{0}/picture?type=large'.format(id)),
      'name'   : 'name',
      'link'   : 'link'
    },
    'google'   : {
      'picture': 'avatar_url',
      'name'   : 'name',
      'family_name': 'family_name',
      'given_name': 'given_name',
      'link'   : 'link',
      'email'  : 'email'
    },
    'windows_live': {
      'avatar_url': 'avatar_url',
      'name'      : 'name',
      'link'      : 'link'
    },
    'twitter'  : {
      'profile_image_url': 'avatar_url',
      'screen_name'      : 'name',
      'link'             : 'link'
    },
    'linkedin' : {
      'picture-url'       : 'avatar_url',
      'first-name'        : 'name',
      'public-profile-url': 'link'
    },
    'foursquare'   : {
      'photo'    : lambda photo: ('avatar_url', photo.get('prefix') + '100x100' + photo.get('suffix')),
      'firstName': 'firstName',
      'lastName' : 'lastName',
      'contact'  : lambda contact: ('email',contact.get('email')),
      'id'       : lambda id: ('link', 'http://foursquare.com/user/{0}'.format(id))
    },
    'openid'   : {
      'id'      : lambda id: ('avatar_url', '/img/missing-avatar.png'),
      'nickname': 'name',
      'email'   : 'link'
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

        ok, user = self.auth.store.user_model.create_user(auth_id, **_attrs)
        if ok:
          self.auth.set_session(self.auth.store.user_to_dict(user))

    # Stores a key / val pair in memcache for the client to query on
    # to match up the user id to the user_token.
    user_token = self.session.get('user_token')
    logging.info('_on_signin session user_token: %s' % user_token)
    if user_token:
      memcache.add('user_token-%s' % user_token, user.key.id(), 60)
      logging.info('Added user_token<->id match - %s, %s' %
                   (user_token, user.key.id()))

    # Go to the profile page
    self.redirect('/profile/%s?close=1' % user.key.urlsafe())

  def logout(self):
    self.auth.unset_session()
    self.redirect(self.request.get('continue', '/login?r=0'))

  def handle_exception(self, exception, debug):
    logging.error(exception)
    self.output_response({'exception': exception}, 'auth_error.html')

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
