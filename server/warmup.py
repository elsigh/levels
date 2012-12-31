#!/usr/bin/python2.7.2
#
#

import logging
import os

# Gets the UA parser into memory.
from lib.ua_parser.py import user_agent_parser

from google.appengine.ext import webapp

from django import template
template.add_to_builtins('lib.custom_filters')
template.add_to_builtins('lib.external.verbatim_templatetag')


class WarmupRequestHandler(webapp.RequestHandler):
    """
    See http://code.google.com/appengine/docs/python/config/appconfig.html#Warmup_Requests
    for documentation on warmup requests
    """

    def initialize(self, request, response):
        super(WarmupRequestHandler, self).initialize(request, response)
        os.environ['DJANGO_SETTINGS_MODULE'] = 'settings'

    def post(self):
        pass

    def get(self):
        # Perform a parse of a UA string just for kicks.
        parsed_ua = user_agent_parser.Parse('FMB rocks/1.0')
        logging.info('Parsed fake UA: %s' % parsed_ua)


app = webapp.WSGIApplication(
        [('.*', WarmupRequestHandler)])
