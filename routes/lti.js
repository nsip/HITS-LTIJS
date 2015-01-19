var express = require('express');
var router = express.Router();

var lti = require('lti');

/* GET users listing. */
router.get('/launch', function(req, res) {

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

// Little function to show all templates
router.get('/show', function(req, res) {
	req.getConnection(function(err, dbh) {
		if (err) throw err;
		dbh.query(
			// 'SELECT * FROM vendor',
			'SELECT * FROM hits_sif3_infra.SIF3_APP_TEMPLATE',
			function(err, results) {
				if (err) res.json(err);
				if (results.length > 0)
					res.json(results);
				else 
					res.json('No data found');
			}
		);
	});
});

router.get('/show/:id', function(req, res) {
	var id = req.params.id;
	req.getConnection(function(err, dbh) {
		if (err) throw err;
		dbh.query(
			// 'SELECT * FROM vendor',
			'SELECT * FROM hits_sif3_infra.SIF3_APP_TEMPLATE WHERE USER_TOKEN=?',
			[id],
			function(err, results) {
				if (err) res.json(err);
				if (results.length > 0)
					res.json(results[0]);
				else 
					res.json('No data found');
			}
		);
	});
});

module.exports = router;
