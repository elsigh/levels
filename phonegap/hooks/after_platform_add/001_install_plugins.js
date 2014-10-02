#!/usr/bin/env node

//this hook installs all your plugins

// add your plugins to this list--either
// the identifier, the filesystem location
// or the URL
var pluginlist = [
  'org.apache.cordova.network-information',
  'org.apache.cordova.device',
  'org.apache.cordova.battery-status',
  'org.apache.cordova.splashscreen',
  'org.chromium.identity',
  'https://github.com/elsigh/PushPlugin.git',
  'https://github.com/Initsogar/cordova-webintent.git',
  'levels-plugin',
  'contacts-plugin'
];

// no need to configure below

var fs = require('fs');
var path = require('path');
var sys = require('sys');
var exec = require('child_process').exec;

function puts(error, stdout, stderr) {
    sys.puts(stdout);
}

pluginlist.forEach(function(plug) {
    exec('cordova plugin add ' + plug, puts);
});
