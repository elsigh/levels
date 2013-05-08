#!/bin/sh
rm -f /usr/local/bin/dev_appserver.pyc; nosetests-2.7 --with-gae --without-sandbox

#--nocapture --logging-level=INFO tests.test_controllers:RequestHandlerTest.test_send_battery_notifications
