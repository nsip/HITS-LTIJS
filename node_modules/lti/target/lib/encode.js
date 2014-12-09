(function() {
  var encode, lazy;

  lazy = require('lazy.js');

  encode = {
    rfc3986: function(string) {
      return encodeURIComponent(string).replace(/!/g, '%21').replace(/\*/g, '%2A').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/'/g, '%27');
    },
    url: function(map) {
      return lazy(map).pairs().sortBy(function(_) {
        return _[0];
      }).map(function(t) {
        return encode.rfc3986(t[0].toString()) + '=' + encode.rfc3986(t[1].toString());
      }).toArray().join('&');
    }
  };

  module.exports = Object.freeze(encode);

}).call(this);
