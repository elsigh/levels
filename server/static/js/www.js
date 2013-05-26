var fmb = {
  models: {}
};
/**
 * @param {number} time An ISO time.
 */
fmb.models.prettyDate = function(time){
  var date = new Date(time),
    diff = (((new Date()).getTime() - date.getTime()) / 1000),
    day_diff = Math.floor(diff / 86400);

  if ( isNaN(day_diff) || day_diff < 0 || day_diff >= 31 )
    return;

  return day_diff === 0 && (
      diff < 60 && "just now" ||
      diff < 120 && "1 minute ago" ||
      diff < 3600 && Math.floor( diff / 60 ) + " minutes ago" ||
      diff < 7200 && "1 hour ago" ||
      diff < 86400 && Math.floor( diff / 3600 ) + " hours ago") ||
    day_diff == 1 && "Yesterday" ||
    day_diff < 7 && day_diff + " days ago" ||
    day_diff < 31 && Math.ceil( day_diff / 7 ) + " weeks ago";
};



var fmbProfile = {};

fmbProfile.renderChart = function(user) {
  console.log('fmb.views.Account renderChart_', user['devices']);

  $(user['devices']).each(function(i, device) {
    fmbProfile.drawDeviceChart(device);
  });

};

fmbProfile.drawDeviceChart = function(device) {
  var settingsData = device['settings'];
  if (!settingsData || !settingsData.length) {
    console.log('No chart data for', device['key']);
    return;
  }
  var dataSeries = [];
  $(settingsData).each(function(i, setting) {
    var xDate = new Date(setting['created']);
    dataSeries.push({
      'x': xDate.getTime(),
      'x_readable': xDate.toString(),
      'y': setting['battery_level']
    });
  });

  var data = {
    'xScale': 'time',
    'yScale': 'linear',
    'yMin': 0,
    'yMax': 100,
    'type': 'line',
    'main': [
      {
        'className': '.battery-graph-data-' + device['key'],
        'data': dataSeries
      }
    ]
  };

  var opts = {
    'dataFormatX': function (x) { return new Date(x); },
    'tickFormatX': function (x) { return d3.time.format('%a %I%p')(x); },
    'axisPaddingTop': 20,
    'tickHintX': 4,
    'tickHintY': 2,
    'interpolation': 'basis'
  };

  var myChart = new xChart('line', data,
      '.fmb-device-' + device['key'] + ' .battery-graph',
      opts);

};



fmbProfile.init = function() {
  $('.battery-created').each(function(i, el) {
    var $el = $(el);
    var time = $el.text().trim();
    $el.text(fmb.models.prettyDate(time * 1000));
  });

  $('.battery-level').each(function(i, el) {
    var $el = $(el);
    var level = $el.data('level');
    $el.css('background-image',
            '-webkit-gradient(linear, left top, right top, ' +
                              'color-stop(' + level + '%, #34b2e0), ' +
                              'color-stop(' + level + '%, #666666))');
  });

  $('[data-utc-date]').each(function(i, el) {
    var $el = $(el);
    var utc = $el.data('utc-date');
    var localDate = new Date(utc);
    $el.text(fmb.models.prettyDate(localDate));
  });

  fmbProfile.renderChart(window.fmbUser);
};

