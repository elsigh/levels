#!/usr/bin/python2.5

__author__ = "elsigh@twist.com (Lindsey Simon)"


import time
import os

from django import template
register = template.Library()


def is_production():
    """Whether or not we're running in production or local dev_appserver.

    Returns:
        A boolean, true if we're in production, false for local.
    """
    return 'Development' not in os.environ['SERVER_SOFTWARE']


def get_version():
    if is_production():
        version = os.environ['CURRENT_VERSION_ID']
    else:
        version = time.strftime('%H_%M_%S', time.gmtime())
    return version


@register.filter
def version(resource):
    """Add on a version bit so we can use far future expires.

    In dev mode add random bits to prevent annoying, cough, browsers from
    caching stuff in frames.

    Args:
        resource: A path to a file.
    Returns:
        The resource path with a version bit on the end, ala ?v=26
    """
    # NOTE: Phonegap on Android won't load urls like build.js?v=0.2
    if os.environ['CURRENT_VERSION_ID'] != 'PHONEGAP':
        resource += '?v=%s' % get_version()

    return resource

