followmybattery
================

You're going to need to do something like this on a Mac to get setup:

Install the Google App Engine SDK Launcher
--------------------------------------------

https://developers.google.com/appengine/downloads

File -> Add Existing Application and point it at the "server" directory.

Fire that baby up and you've got the website frontend and API backend running.


Setup for testing the backend
-----------------------------

sudo pip install nose

sudo pip install webtest

Now to install the GAE nose plugin:

svn checkout http://nose-gae.googlecode.com/svn/trunk/ nose-gae-read-only

cd nose-gae-read-only

sudo python setup.py install


Now you should be able to:

cd server;

./run-tests.sh

