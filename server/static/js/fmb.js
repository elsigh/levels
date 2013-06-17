
/**
 * @type {Object}
 */
var fmb = {};


/******************************************************************************/


/**
 * @type {Object} UA namespace.
 */
fmb.ua = {};


/**
 * @type {boolean}
 */
fmb.ua.IS_ANDROID = window.navigator.userAgent.indexOf('Android') !== -1;


/**
 * @type {boolean}
 */
fmb.ua.IS_CORDOVA = typeof cordova !== 'undefined';


/******************************************************************************/


/**
 * @return {Function} The native console.log implementation.
 * @private
 */
fmb.getConsoleLogger_ = function() {
  return _.bind(console.log, console);
};


/**
 * @return {Function} A wrapped up stringifier.
 * @private
 */
fmb.getWebViewLogger_ = function() {
  return _.bind(function() {
      var argumentsArray = _.toArray(arguments);
      var consoleStrings = [];
      _.each(argumentsArray, function(logLine) {
        if (_.isElement(logLine)) {
          consoleStrings.push('isElement-className: ' + logLine.className);
        } else if (_.isObject(logLine)) {
          // Some of our objects have circular references..
          try {
            // Wrapped in quotation marks for later parseability.
            var stringified = '"' + JSON.stringify(logLine) + '"';
            consoleStrings.push(stringified);
          } catch (err) {
            consoleStrings.push(logLine);
          }
        } else {
          consoleStrings.push(logLine);
        }
      });

      var consoleString = consoleStrings.join(', ');
      console.log(consoleString);
    }, console);
};


fmb.injectScript = function(src) {
  script = document.createElement('script');
  script.type = 'text/javascript';
  script.async = true;
  script.onload = function(){
      // remote script has loaded
  };
  script.src = src;
  $('head').get(0).appendChild(script);
};


/**
 * Good times, wrap fmb.log
 */
fmb.log = fmb.ua.IS_ANDROID && fmb.ua.IS_CORDOVA ?
    fmb.getWebViewLogger_() : fmb.getConsoleLogger_();


/**
 * @param {Object} obj An object to clone.
 * @return {Object} A deep clone of the passed in object.
 */
fmb.clone = function(obj) {
  return JSON.parse(JSON.stringify(obj));
};