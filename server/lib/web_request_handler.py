#!/usr/bin/python2.7
# -*- coding: utf_8 -*-
#
#

import httplib
import json
import logging
import os
import webapp2

from lib.external.ua_parser.py import user_agent_parser

import custom_filters
from django import template
template.add_to_builtins('lib.custom_filters')
template.add_to_builtins('lib.verbatim_templatetag')

from django.template.loader import get_template
from django.template import Context

import settings


class WebRequestHandler(webapp2.RequestHandler):
    """
    WebRequestHandler
    """

    def get_js_templates(self):
        # check if the property exists, if not then add it
        # In production we'll cache templates, in dev refresh every time.
        yaml_file_name = self._get_yaml_file_name
        if (not yaml_file_name in WebRequestHandler._global_js or
                not WebRequestHandler.is_production()):
            templates = {}
            yaml_config = self.build_deps_yaml()
            for src in yaml_config['templates']:
                path = os.path.join(settings.TEMPLATE_DIRS, src)
                f = open(path, 'r')

                bits = path.split('/')
                filename = bits[len(bits) - 1]
                key_name = filename.replace('.mustache', '')

                templates[key_name] = f.read()
                f.close()
            WebRequestHandler._global_js[yaml_file_name] = templates

        return WebRequestHandler._global_js[yaml_file_name]

    @staticmethod
    def is_production():
        return custom_filters.is_production()

    @staticmethod
    def get_version():
        return custom_filters.get_version()

    def initialize(self, request, response):
        logging.info('WebRequestHandler initialize.')
        super(WebRequestHandler, self).initialize(request, response)
        if request.method != 'OPTIONS':
            self.browser_detect()
        os.environ['DJANGO_SETTINGS_MODULE'] = 'settings'

    def apply_cors_headers(self):
        self.response.headers['Access-Control-Allow-Origin'] = '*'
        self.response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, DELETE'
        self.response.headers['Access-Control-Allow-Credentials'] = 'true'
        self.response.headers['Access-Control-Allow-Headers'] = 'Content-Type,X-Requested-With'

    def browser_detect(self):
        """Tests the UA string for compatibility."""
        user_agent_string = self.request.headers.get('USER_AGENT')

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
        is_production = WebRequestHandler.is_production()
        tpl_data.update({
            'title_app': 'Follow My Battery',
            'is_production': is_production,
            'user_agent': self._user_agent,
            'user_agent_json': json.dumps(self._user_agent),
            'build_version': WebRequestHandler.get_version(),
        })

        logging.info('output_response: template render start- %s' % tpl_name)
        tpl = get_template(tpl_name)
        rendered = tpl.render(Context(tpl_data))
        logging.info('output_response: template render done - %s' % tpl_name)
        self.response.write(rendered)
        logging.info('WebRequestHandler DONE.')


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
    os.environ['DJANGO_SETTINGS_MODULE'] = 'settings'
    logging.info('ErrorHandler code %s' % code)
    logging.info('Exception: %s' % exception)
    is_production = WebRequestHandler.is_production()
    user_agent_string = request.headers.get('USER_AGENT')
    ua_dict = user_agent_parser.Parse(user_agent_string)
    logging.info('UA: %s' % ua_dict)
    tpl_data = {
        'is_production': is_production,
        'error_code': code,
        'error_code_text': httplib.responses[code],
        'error_message': exception,
        'user_agent_json': json.dumps(ua_dict),
    }
    tpl = get_template('error.html')
    rendered = tpl.render(Context(tpl_data))
    response.set_status(code)
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,X-Requested-With'
    response.write(rendered)


def ErrorNotFoundRequestHandler(request, response, exception):
    """Generic 404 error handler."""
    ErrorHandler(request, response, exception, 404)


def ErrorInternalRequestHandler(request, response, exception):
    """Generic 500 error handler."""
    ErrorHandler(request, response, exception, 500)
