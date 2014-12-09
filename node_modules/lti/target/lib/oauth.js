(function() {
  var bilby, lazy, oauth, oauthsign;

  bilby = require('bilby');

  lazy = require('lazy.js');

  oauthsign = require('oauth-sign');

  oauth = {
    authorization: function(method, url, parameters, consumerKey, consumerSecret) {
      var params;
      params = bilby.extend(parameters, {
        oauth_callback: 'about:blank',
        oauth_consumer_key: consumerKey,
        oauth_nonce: oauth.nonce(),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor((new Date()).getTime() / 1000),
        oauth_version: '1.0'
      });
      return oauth.sign(method, url, params, consumerSecret).cata({
        success: (function(signature) {
          return bilby.success({
            oauth_callback: params.oauth_callback,
            oauth_consumer_key: params.oauth_consumer_key,
            oauth_nonce: params.oauth_nonce,
            oauth_signature: signature,
            oauth_signature_method: params.oauth_signature_method,
            oauth_timestamp: params.oauth_timestamp,
            oauth_version: params.oauth_version
          });
        }),
        failure: bilby.failure('Expected valid signature.')
      });
    },
    nonce: function() {
      var base64, _i, _results;
      base64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
      return lazy((function() {
        _results = [];
        for (_i = 0; _i <= 31; _i++){ _results.push(_i); }
        return _results;
      }).apply(this)).map(function() {
        return base64[Math.floor(Math.random() * base64.length)];
      }).toArray().join('');
    },
    sign: function(method, url, parameters, consumerSecret) {
      switch (parameters.oauth_signature_method || null) {
        case 'HMAC-SHA1':
          return bilby.success(oauthsign.hmacsign(method, url, parameters, consumerSecret));
        default:
          return bilby.failure(['Expected supported signature method.']);
      }
    }
  };

  module.exports = Object.freeze(oauth);

}).call(this);
