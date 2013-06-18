LEVELS
================

You're going to need to do something like this on a Mac to get setup:

Install the Google App Engine SDK Launcher
--------------------------------------------

https://developers.google.com/appengine/downloads

`File -> Add Existing Application` and point it at the `server` directory.

Fire that baby up and you've got the website frontend and API backend running.


Process
-----------------------------

Fuck process. Ok, well, at least run the unit tests below before submitting.
Also, I seem to prefer the idea that you submit code to your own branch and
then issue a pull request from that branch (which you can self-merge for now).
I'm open to whatever. And once TravisCI supports running on private repos we'll
wire up the unit tests.


Setup for testing the backend
-----------------------------

```bash
sudo pip install mock
sudo pip install nose
sudo pip install webtest
```

Now to install the GAE nose plugin:

```bash
svn checkout http://nose-gae.googlecode.com/svn/trunk/ nose-gae-read-only
cd nose-gae-read-only
sudo python setup.py install
```

You should be able to run the server tests:

```bash
cd server;
./run-tests.sh
```


Frontend - Android
-----------------------------

You'll need Java + the Android SDK.

Install and run the debug client:

```base
cd client/android;
./debug.sh
```

Run the tests:

```bash
cd client/android/assets/www/tests;
./phantomjs phantomjs_run_closure_test.js
```


Frontend - iOS
-----------------------------

brew install ios-sim
cd client/ios
