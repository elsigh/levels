#!/usr/bin/python2.7

"""Mapreduce handlers and functions."""

__author__ = 'elsigh@gmail.com (Lindsey Simon)'

import logging
import sys

from lib import models
from lib.external.mapreduce import operation as op, context
from google.appengine.ext import ndb
sys.modules['ndb'] = ndb


def NotificationSettingsFixer(entity):
  user = entity.key.parent().get()
  for device in user.iter_devices:
    q = models.Settings.query(ancestor=device.key)
    q = q.filter(models.Settings.created < entity.created)
    q = q.order(-models.Settings.created)
    last_setting = q.get()
    if last_setting:
      last_setting.caused_battery_notifications = True
      yield op.db.Put(last_setting)
