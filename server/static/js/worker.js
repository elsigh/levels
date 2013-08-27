
self.addEventListener('message', function(e) {
  var data = e.data;
  switch (data.cmd) {
    case 'start':
      self.postMessage('WORKER STARTED: ' + data.msg);
      self.postMessage('window.navigator.battery: ' +
          navigator && navigator.battery);
      startTimeout();
      break;
    case 'stop':
      self.postMessage('WORKER STOPPED: ' + data.msg +
                       '. (buttons will no longer work)');
      self.close(); // Terminates the worker.
      break;
    default:
      self.postMessage('Unknown command: ' + data.msg);
  }
}, false);


startTimeout = function() {
  self.postMessage('startTimeout');
  setInterval(function() {
    self.postMessage('Aloha ' + new Date().getTime() + ' ' +
        navigator && navigator.battery);
  }, 10000);
};
