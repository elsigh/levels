#!/bin/sh
rm -f /usr/local/bin/dev_appserver.pyc; nosetests-2.7 --with-gae --without-sandbox --logging-level=INFO

#--nocapture --logging-level=DEBUG tests.test_controllers:HandlerTest.test_send_battery_notifications
