var express = require('express');
var router = express.Router();

var lti = require('lti');

/* GET users listing. */
router.get('/', function(req, res) {

	// consumer = new lti.ToolConsumer('https://example.com/path/to/producer', 'key', 'secret')
	consumer = new lti.ToolConsumer('http://ltiapps.net/test/tp.php', 'key', 'secret')

/*
	consumer.withSession((session) ->
		payload =
		lti_version: 'LTI-1p0'
		lti_message_type: 'basic-lti-launch-request'
		resource_link_id: '0'

		session.basicLaunch(payload)
		.then((r) -> r.map((_) -> console.dir(_)))
		.catch((e) -> console.dir(e))
		.done()
	)
*/

	console.log(consumer);

	consumer.withSession(function(session) {
		var payload;
		payload = {
			lti_version: 'LTI-1p0',
			lti_message_type: 'basic-lti-launch-request',
			resource_link_id: '0'
		};
		return session.basicLaunch(payload).then(function(r) {
			return r.map(function(_) {
				// return console.dir(_);
				res.send(_);
			});
		})["catch"](function(e) {
			return console.dir(e);
		}).done();
	});
	
	// res.send('respond with a resource');
});

module.exports = router;
