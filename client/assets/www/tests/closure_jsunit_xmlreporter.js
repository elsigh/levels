/**
 * @author elsigh@gmail.com (Lindsey Simon)
 * @fileoverview Closure JSUnit output formatter for CLI.
 *
 * I'm so sure there are better ways of doing this, but I just want something
 * that works that can be called out from the test runner.
 * Note: None of these symbols are exported so they won't work in
 * ADVANCED compilation mode, though why you would advanced compile the test
 * framework is beyond me.
 */

function ISODateString(t) {
  var d = new Date();
  d.setTime(t);
  function pad(n) { return n < 10 ? '0'+n : n; }

  return d.getFullYear() + '-' +
      pad(d.getMonth()+1) + '-' +
      pad(d.getDate()) + 'T' +
      pad(d.getHours()) + ':' +
      pad(d.getMinutes()) + ':' +
      pad(d.getSeconds());
}

function trim(str) {
  return str.replace(/^\s+/, "" ).replace(/\s+$/, "" );
}

function escapeInvalidXmlChars(str) {
  return str.replace(/\&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/\>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/\'/g, "&apos;");
}

/**
 * Returns a report of the test case that ran.
 * Used by Selenium Hooks.
 * @return {string} A XML report summary of the test.
 */
goog.testing.TestRunner.prototype.getJunitReport =
    function(opt_includeXmlHeader) {
  var includeXmlHeader = typeof opt_includeXmlHeader == 'undefined' ?
      true : opt_includeXmlHeader;
  var report = includeXmlHeader ?
      '<?xml version="1.0" encoding="UTF-8" ?>\n' : '';
  report += '<testsuite name="' +
      escapeInvalidXmlChars(this.testCase.name_) + '" ' +
      'errors="' + this.errors.length + '" ' +
      'tests="' + this.testCase.tests_.length + '" ' +
      'failures="' + this.testCase.result_.errors.length + '" ' +
      'time="' + (this.getRunTime() / 1000) + '" ' +
      'timestamp="' + ISODateString(this.testCase.startTime_) + '">';
  report += '\n<properties>\n';
  report += '<property name="navigator.userAgent" value="' +
      escapeInvalidXmlChars(navigator.userAgent) + '" />\n';
  report += '</properties>\n';
  report += this.testCase.getJunitReport();
  report += "</testsuite>";
  return report;
};

/**
 * Returns a string detailing the results from the test.
 * @return {string} report XML results from the test.
 */
goog.testing.TestCase.prototype.getJunitReport = function() {
  this.updateTestsMapWithGoodies_();
  var report = '';
  for (var i = 0, test; test = this.tests_[i]; i++) {
    report +=
        '<testcase classname="' + escapeInvalidXmlChars(this.name_) + '" ' +
        'name="' + escapeInvalidXmlChars(test.name) + '" ' +
        'time="' + test.runTime + '">';
    if (test.error) {
      report += '\n<error message="' +
          escapeInvalidXmlChars(test.error.message) + '" type="meh">' +
          escapeInvalidXmlChars(test.error.stack) + '</error>\n';
    }
    report += '</testcase>\n';
  }

  return report;
};


/**
 * Why for the love of Baby Jesus' name did I have to write this?
 * This ties the error object to the test which failed as well as tacks on
 * each test's run time.
 * @private
 */
goog.testing.TestCase.prototype.updateTestsMapWithGoodies_ = function() {

  var messageMap = {};
  var lastMessageDate;
  // Make a map out of the result messages array because that's so much fun.
  for (var i = 0, n = this.result_.messages.length; i < n; i++) {
    var message = this.result_.messages[i];
    var messageJunk = message.split('  ');

    // Make sure we have a date object for each message's timestamp.
    var timestamp = messageJunk[0];
    var time = timestamp.split(':');
    var date = new Date();
    date.setHours(time[0]);
    date.setMinutes(time[1]);
    var secMil = time[2].split('.');
    date.setSeconds(secMil[0]);
    date.setMilliseconds(secMil[1]);

    var testNameJunk = messageJunk[1].split(' : ');
    var testNameMaybe = testNameJunk[0];
    messageMap[testNameMaybe] = {
      date: date,
      runTime: lastMessageDate ? date.getTime() -lastMessageDate.getTime() : 0
    };
    lastMessageDate = date;
  }

  // Assign each test's error to the test object (if there)
  // and set it's a run time.
  for (var i = 0, test; test = this.tests_[i]; i++) {
    for (var j = 0, error; error = this.result_.errors[j]; j++) {
      if (error.source == test.name) {
        test.error = error;
      }
    }

    var testMessageObj = messageMap[test.name];
    if (testMessageObj) {
      test.runTime = testMessageObj.runTime / 1000;
    }
  }
};


