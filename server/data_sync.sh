#!/bin/bash

rm -f data.sqlite3;
appcfg.py -e elsigh@gmail.com download_data --url=http://followmybattery.appspot.com/_ah/remote_api --filename=data.sqlite3;
rm bulkloader*;
