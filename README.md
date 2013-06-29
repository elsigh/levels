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

Fuck process. Ok, well, at least try running the unit tests.
Also, I seem to prefer the idea that you submit code to your own branch and
then issue a pull request from that branch (which you can self-merge for now).
I'm open to whatever.

Also do this from the repo root (runs pep8 + gjslint):

```bash
cd .git/hooks
ln -s ../../pre-commit .
```

Setup for testing the backend
-----------------------------

```bash
sudo pip install -r server/requirements.txt
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


Frontend - testing
-----------------------------

You should be able to run the client tests:

```bash
cd client;
./run_tests.sh
```

Install gjslint:

```bash
sudo easy_install http://closure-linter.googlecode.com/files/closure_linter-latest.tar.gz
```

Also, you should be able to load up the test file client/tests/app.html
in a browser for more debug/testing.


Frontend - Android
-----------------------------

You'll need Java + the Android SDK.

Install and run the debug client:

```bash
cd client/android;
./debug.sh
```


Frontend - iOS
-----------------------------

```bash
brew install ios-sim
cd client/ios
```
