#!/bin/bash

cd tests;
./phantomjs ./phantomjs_run_closure_test.js fmb.html
./phantomjs ./phantomjs_run_closure_test.js app.html?test=1
cd ../;
