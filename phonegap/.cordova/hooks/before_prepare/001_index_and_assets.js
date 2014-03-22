#!/usr/bin/env node

/**
 * @fileoverview This script copies the server/static/app.html to the expected
 * Cordova path www/index.html and modifies it in the process:
 *    - Adds a script tag for cordova.js
 *    - Changes absolute asset paths to be relative.
 *    - Copies over contents of static asset dirs: js, css, and img.
 */

var fs = require('fs');
var path = require('path');

var child = require('child_process');

var pathToCordovaAssets = path.join('.', 'www');
var pathToCordovaIndex = path.join(pathToCordovaAssets, 'index.html');

var assetDirs = ['css', 'js', 'img'];


/**
 * Look ma, it's rm -rf.
 * @param {string} src The path to the thing to rm.
 */
var deleteRecursiveSync = function(src) {
  var exists = fs.existsSync(src);
  var stats = exists && fs.statSync(src);
  var isDirectory = exists && stats.isDirectory();
  var isSymbolicLink = exists && stats.isSymbolicLink();
  if (exists && isDirectory && !isSymbolicLink) {
    fs.readdirSync(src).forEach(function(childItemName) {
      deleteRecursiveSync(path.join(src, childItemName));
    });
    fs.rmdirSync(src);
  } else if (exists) {
    fs.unlinkSync(src);
  }
};


/**
 * Look ma, it's cp -R.
 * @param {string} src The path to the thing to copy.
 * @param {string} dest The path to the new copy.
 */
var copyRecursiveSync = function(src, dest) {
  var exists = fs.existsSync(src);
  var stats = exists && fs.statSync(src);
  var isDirectory = exists && stats.isDirectory();
  var isSymbolicLink = exists && stats.isSymbolicLink();
  //console.log(src, 'exists', exists, 'isSymbolicLink?', isSymbolicLink);
  if (exists && isDirectory) {
    fs.mkdirSync(dest);
    fs.readdirSync(src).forEach(function(childItemName) {
      copyRecursiveSync(path.join(src, childItemName),
                        path.join(dest, childItemName));
    });
  } else if (isSymbolicLink) {
    var realPath = fs.realpathSync(src);
    fs.linkSync(realPath, dest);

  } else {
    fs.linkSync(src, dest);
  }
};


/**
 * Copies app.html from the server and fixes paths, renames to index.html
 */
var copyAndFixAppTemplate = function() {
  var pathServerTemplates = path.join('../server/templates');
  var serverAppIndex = path.join(pathServerTemplates, 'app.html');
  if (fs.existsSync(serverAppIndex)) {
    var str = fs.readFileSync(serverAppIndex, 'utf8');

    // Add cordova.js
    str = str.replace('</head>',
                      '  <script src="cordova.js"></script>\n  </head>');


    // Make absolute static paths relative, minus the "static" bit.
    assetDirs.forEach(function(dir) {
      var re = new RegExp('"/' + dir + '/', 'g');
      str = str.replace(re, '"' + dir + '/');
    });
    fs.writeFileSync(pathToCordovaIndex, str, 'utf8');
  }
};


/**
 * Copy over assets so there is but one source of truth.
 */
var syncAssetDirectories = function() {
  // Clean up asset dirs and then make symlinks to our server dir.
  var pathServerStatic = path.join('../server/static');
  assetDirs.forEach(function(dir) {
    var pathCordovaAsset = path.join(pathToCordovaAssets, dir);
    var pathToSourceOfTruth = path.join(pathServerStatic, dir);
    console.log('Synchronizing', pathToSourceOfTruth, '->', pathCordovaAsset);

    deleteRecursiveSync(pathCordovaAsset);
    //console.log('Nuked', pathCordovaAsset);

    copyRecursiveSync(pathToSourceOfTruth, pathCordovaAsset);
    //console.log('Copied', pathToSourceOfTruth);
  });
};


/**
 * Main routine ;0
 */
copyAndFixAppTemplate();
syncAssetDirectories();
