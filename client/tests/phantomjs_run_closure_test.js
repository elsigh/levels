/**
 * This is a phantomjs script which will run a closure jsunit test. This is
 * based on many of the examples in the phantomjs/examples directory.
 * @author elsigh@gmail.com (Lindsey Simon)
 */


/*
phantom.injectJs('support/phantomjs_args_parser.js');

var parsedArgs = PhantomArgsParser.parseArgs(phantom.args, {
  minArgs: 1,
  maxArgs: 1,
  onFail: function(message) {
    console.log(message);
    console.log('Usage: phantomjs_closure_test_runner.js URL ' +
        '[--output_junit] [--output_console_log]');
    phantom.exit(1);
  }
});
*/

var parsedArgs = {};
var opt = 0;
var fileToTest = phantom.args[0];

/*
try {
  console.log('ARGS:' + phantom.args);
  while (opt < phantom.args.length && phantom.args[opt][0] == '-') {
    var switchKey = phantom.args[opt].replace(/-/g, '');
    opt++;
    parsedArgs[switchKey] = phantom.args[opt] == 1;
    opt++;
  }
  fileToTest = phantom.args[opt];  // last item is the filename.
} catch(e) {
  console.log('Usage: phantomjs_closure_test_runner.js URL ' +
              '[--output_junit 1] [--output_console_log 1]');
}
console.log('parsedArgs', JSON.stringify(parsedArgs), fileToTest);
*/

/**
 * @type {number}
 */
var TEST_TIMEOUT = 3001;


/**
 * Wait until the test condition is true or a timeout occurs. Useful for waiting
 * on a server response or for a ui change (fadeIn, etc.) to occur.
 * @param {Function|string} testFx javascript condition that evaluates to a
 *     boolean, it can be passed in as a string (e.g.: "1 == 1" or
 *     "$('#bar').is(':visible')" or as a callback function.
 * @param {Function|string} onReady what to do when testFx condition is
 *     fulfilled, it can be passed in as a string.
 *     (e.g.: "1 == 1" or "$('#bar').is(':visible')" or as a callback function.
 * @param {number=} opt_timeOutMillis the max amount of time to wait.
 */
function waitFor(testFx, onReady, opt_timeOutMillis) {
  //< Default Max Timeout is 3s
  var maxtimeOutMillis = opt_timeOutMillis ? opt_timeOutMillis : TEST_TIMEOUT;
  var start = new Date().getTime();
  var condition = false;
  var interval = setInterval(function() {
    if ((new Date().getTime() - start < maxtimeOutMillis) && !condition) {
      // If not time-out yet and condition not yet fulfilled
      //< defensive code
      condition = (typeof(testFx) === 'string' ? eval(testFx) : testFx());
    } else {
      if (!condition) {
        // If condition still not fulfilled (timeout but condition is 'false')
        console.log('waitFor() timeout');
        phantom.exit(1);
      } else {
        // Condition fulfilled (timeout and/or condition is 'true')
        //console.log("'waitFor()' finished in " +
        //    (new Date().getTime() - start) + 'ms.');

        //< Do what it's supposed to do once the condition is fulfilled
        typeof(onReady) === 'string' ? eval(onReady) : onReady();
        clearInterval(interval); //< Stop this interval
      }
    }
  }, 100);  // repeat check
}


var page = require('webpage').create();
var fs = require('fs');

// Opens the test page and executes the tests.
page.open(fileToTest, function(status) {
  if (status !== 'success') {
    console.log('Unable to access network, status:' + status);
    phantom.exit(1);
  } else {
    /*
    if (parsedArgs.outputConsoleLog) {
      page.onConsoleMessage = function(msg, line, file) {
        console.log(msg);
      };
    }
    */

    waitFor(
        function() {
          return page.evaluate(function() {
            return window.G_testRunner.isFinished();
          });
        },
        function() {
          var isFinished = page.evaluate(function() {
            return window.G_testRunner.isFinished();
          });
          var report = page.evaluate(function() {
            return window.G_testRunner.getReport();
          });
          var testName = page.evaluate(function() {
            return window.G_testRunner.testCase.name_.replace(/\s/g, '_');
          });
          /*
          var junitReport = page.evaluate(function() {
            return window.G_testRunner.getJunitReport();
          });
          */
          var isSuccess = page.evaluate(function() {
            return window.G_testRunner.isSuccess();
          });
          /*
          if (parsedArgs.outputJunit) {
            var outputFile = fs.workingDirectory + '/TEST-' + testName + '.xml';
            fs.write(outputFile, junitReport, 'w');
            console.log('Outputting JUnit XML to: ' + outputFile);
          }
          */
          console.log(report);
          var exitCode = isSuccess ? 0 : 1;
          phantom.exit(exitCode);
        },
        10000);
  }
});
