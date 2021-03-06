#!/usr/bin/python2.7
# -*- coding: utf_8 -*-
#
#

import datetime
import httplib
import json
import logging
import os
import sys
import time
import urllib2
from urlparse import urlparse
import webapp2
from webapp2_extras import auth, sessions, jinja2
from jinja2.runtime import TemplateNotFound

from lib.external.ua_parser.py import user_agent_parser

# Hack to get ndb into the modules list.
from google.appengine.ext import deferred
from google.appengine.ext import ndb
sys.modules['ndb'] = ndb

import settings


class WebRequestHandler(webapp2.RequestHandler):
    """
    WebRequestHandler
    """

    def dispatch(self):
        # Get a session store for this request.
        self.session_store = sessions.get_store(request=self.request)

        try:
            # Dispatch the request.
            webapp2.RequestHandler.dispatch(self)
        finally:
            # Save all sessions.
            self.session_store.save_sessions(self.response)

    @webapp2.cached_property
    def jinja2(self):
        """Returns a Jinja2 renderer cached in the app registry"""
        return jinja2.get_jinja2(app=self.app)

    @webapp2.cached_property
    def session(self):
        """Returns a session using the default cookie key"""
        return self.session_store.get_session()

    @webapp2.cached_property
    def auth(self):
        return auth.get_auth()

    @webapp2.cached_property
    def current_user(self):
        """Returns currently logged in user"""
        # For the website, which can just use straight up sessions.
        user_dict = self.auth.get_user_by_session()
        if user_dict is not None:
            user = self.auth.store.user_model.get_by_id(user_dict['user_id'])
            return user

        return None

    @webapp2.cached_property
    def is_production(self):
        return 'Development' not in os.environ['SERVER_SOFTWARE']

    @webapp2.cached_property
    def version(self):
        if self.is_production:
            version = os.environ['CURRENT_VERSION_ID']
        else:
            version = time.strftime('%H_%M_%S', time.gmtime())
        return version

    def get_full_url(self, path):
        """Return the full url from the provided request handler and path."""
        pr = urlparse(self.request.url)
        return '%s://%s%s' % (pr.scheme, pr.netloc, path)

    def set_json_request_data(self):
        self._json_request_data = {}
        content_type = self.request.headers.get('content-type')
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
        logging.info('JSON REQ DATA: %s' % self._json_request_data)

    def initialize(self, request, response):
        #logging.info('WebRequestHandler initialize.')
        super(WebRequestHandler, self).initialize(request, response)
        if request.method != 'OPTIONS':
            self.browser_detect()

    def head(self, *args):
        """Head is used by Twitter. If not there the tweet button shows 0"""

    def browser_detect(self):
        """Tests the UA string for compatibility."""
        # Default UA string is for unit tests.
        user_agent_string = self.request.headers.get(
            'USER_AGENT', settings.USER_AGENT)

        # aka unittests
        if not user_agent_string:
            self._user_agent = {}
            return

        ua_dict = user_agent_parser.Parse(user_agent_string)

        self._user_agent = ua_dict
        self._user_agent.update({
            'pretty': user_agent_parser.PrettyUserAgent(
                ua_dict['user_agent']['family'],
                ua_dict['user_agent']['major'],
                ua_dict['user_agent']['minor'],
                ua_dict['user_agent']['patch'])
        })
        logging.info('UA: %s' % self._user_agent)

    def output_response(self, tpl_data, tpl_name):
        """Renders a template with some useful pre-populated data.

        Args:
            tpl_data: A dictionary of template data.
            tpl_name: A string matching a file path in the templates dir.

        Returns:
            An HTTP response with the rendered template.
        """
        logging.info('output_response: start')
        tpl_data.update({
            'title_app': 'Follow My Battery',
            'is_production': self.is_production,
            'user_agent': self._user_agent,
            'user_agent_json': json.dumps(self._user_agent),
            'build_version': self.version,
            'url_for': self.uri_for,
            'url_path': self.request.path,
            'current_user': self.current_user,
        })

        try:
            self.response.write(self.jinja2.render_template(
                tpl_name, **tpl_data))
            logging.info('output_response: done')
        except TemplateNotFound:
            self.abort(404)
        pass

    def apply_cors_headers(self):
        self.response.headers['Access-Control-Allow-Origin'] = \
            self.request.headers.get('Origin', '*')
        self.response.headers['Access-Control-Allow-Methods'] = \
            'GET, POST, OPTIONS, PUT, DELETE'
        self.response.headers['Access-Control-Allow-Credentials'] = 'true'
        self.response.headers['Access-Control-Allow-Headers'] = \
            'Content-Type,X-Requested-With'

    # This is a weird and crappy way to deal with datetime - surely someone
    # knows a better one. Also it's duplicated in models.py.
    @classmethod
    def json_dump(cls, obj):
        date_handler = (lambda obj: obj.isoformat()
                        if isinstance(obj, datetime.datetime) else None)
        return json.dumps(obj, default=date_handler)

    def output_json(self, obj):
        self.apply_cors_headers()
        self.response.headers['Content-Type'] = 'application/json'
        json_out = WebRequestHandler.json_dump(obj)
        logging.info('output_json: %s' % json_out)
        self.response.out.write(json_out)

    def output_json_success(self, obj={}):
        obj['status'] = 0
        self.output_json(obj)

    def output_json_error(self, obj={}, error_code=404):
        obj['status'] = 1
        self.response.set_status(error_code)
        self.output_json(obj)


class TemplatesRequestHandler(webapp2.RequestHandler):
    """This is a for the local tests."""
    def get(self, template):
        tpl_path = os.path.join(settings.TEMPLATE_DIRS, template)
        tpl_file = open(tpl_path, 'r')
        tpl = tpl_file.read()
        tpl_file.close()
        self.response.out.write(tpl)


def ErrorHandler(request, response, exception, code):
    """A webapp2 implementation of error_handler."""
    logging.info('ErrorHandler code %s' % code)
    logging.info('Exception: %s' % exception)

    response.set_status(code)
    response.headers['Access-Control-Allow-Origin'] = \
        request.headers.get('Origin', '*')
    response.headers['Access-Control-Allow-Methods'] = \
        'GET, POST, OPTIONS, PUT'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Access-Control-Allow-Headers'] = \
        'Content-Type,X-Requested-With'

    # Default UA string is for unit tests.
    user_agent_string = request.headers.get(
        'USER_AGENT', settings.USER_AGENT)

    ua_dict = user_agent_parser.Parse(user_agent_string)
    logging.info('UA: %s' % ua_dict)
    tpl_data = {
        'error_code': code,
        'error_code_text': httplib.responses[code],
        'error_message': exception,
        'user_agent': ua_dict
    }
    jinja2_instance = jinja2.get_jinja2()
    rendered = jinja2_instance.render_template('error.html', **tpl_data)
    response.write(rendered)


def ErrorNotFoundRequestHandler(request, response, exception):
    """Generic 404 error handler."""
    ErrorHandler(request, response, exception, 404)


def ErrorInternalRequestHandler(request, response, exception):
    """Generic 500 error handler."""
    ErrorHandler(request, response, exception, 500)
