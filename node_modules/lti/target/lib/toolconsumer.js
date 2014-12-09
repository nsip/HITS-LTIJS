(function() {
  var Http, ToolConsumer, bilby, toolconsumer;

  bilby = require('bilby');

  Http = require('./http');

  toolconsumer = ToolConsumer = (function() {
    function ToolConsumer(baseUrl, consumerKey, consumerSecret) {
      this.baseUrl = baseUrl;
      this.consumerKey = consumerKey;
      this.consumerSecret = consumerSecret;
    }

    ToolConsumer.prototype.withSession = function(f) {
      var http;
      http = new Http(this.baseUrl, this.consumerKey, this.consumerSecret);
      return f(Object.freeze({
        basicLaunch: bilby.bind(http.post)(http)
      }));
    };

    return ToolConsumer;

  })();

  module.exports = Object.freeze(toolconsumer);

}).call(this);
