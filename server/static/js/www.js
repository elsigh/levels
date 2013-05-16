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

  var settingsData = user['devices'].length && user['devices'][0]['settings'] ||
                     [];

  if (!settingsData.length) {
    console.log('No setting data to render chart with.')
    return;
  }
  var dataSeries = [];
  $(settingsData).each(function(i, setting) {
    dataSeries.push({
      x: i,
      y: setting['battery_level']
    })
  });

  /*
  var dataSeries = [
            { x: 0, y: 40 },
            { x: 1, y: 49 },
            { x: 2, y: 38 },
            { x: 3, y: 70 },
            { x: 4, y: 92 } ];
  */
  console.log('dataSeries', dataSeries);

  var $graphEl = $('.battery-chart .chart');
  var graph = new Rickshaw.Graph({
    element: $graphEl.get(0),
    renderer: 'area',
    height: $graphEl.height(),
    width: $graphEl.width(),
    series: [
      {
        data: dataSeries,
        color: 'steelblue'
      }
    ]
  });

  var yTicks = new Rickshaw.Graph.Axis.Y({
    graph: graph,
    orientation: 'left',
    tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
    element: $('.battery-chart .y-axis').get(0),
  });

  graph.render();
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
                              'color-stop(' + level + '%, green), ' +
                              'color-stop(' + level + '%, white))');

  });

  fmbProfile.renderChart(window.fmbUser);
};

