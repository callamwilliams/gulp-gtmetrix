'use strict';

var gutil = require('gulp-util'),
	readline = require('readline'),
	self = this,
	rl,
	gtmetrix = require('gtmetrix')({
		email: '',
		apikey: '',
		timeout: '10000'
	});

exports.init = function(config) {

// question section
	rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	rl.question('Which URL would you like to test with GTmetrix?\n', (url) => {

		self.fetch(url);

	});

// send the site url to be tested

	self.fetch = function(url) {
		var options = {
			url: 'http://' + url,
			location: 2, // London
			browser: 3 // Chrome
		};

		gtmetrix.test.create(options, function(err, data) {
			if (!err) {
				self.site_url(url, data.test_id);
			} else {
				gutil.log(gutil.colors.red('Error: ' + err.error));
				process.exit(1);
			}
		});

	};


// dirty poll the api with a generator function to check for test completion

	self.site_url = function(url, test_id) {

		let generator = function *() {

			let state = null;

			var test_url = `Full results and improvement suggestions can be seen here: https://gtmetrix.com/reports/${url}/${test_id}`

			gutil.log(gutil.colors.green(test_url));

			while(state !== 'completed') {

				yield gtmetrix.test.get(test_id, function(err, data) {

					if (!err) {

						if(state != data.state){
							gutil.log(gutil.colors.blue('speedtest ' + data.state + '...'));
						}

						state = data.state;

						if(state == 'completed'){
						  self.score(data);
						}

						set.next();

					} else {
						gutil.log(gutil.colors.red('Error: ' + err.error));
						process.exit(1);
					}

				});

			}

		}

		var set = generator();

		set.next();

	};

// return the test results

	self.score = function(response) {
		// convert milliseconds to seconds
		var page_load_time = (response.results.page_load_time/1000)%60;
		var page_elements = response.results.page_elements;
		var page_bytes = (response.results.page_bytes / 1048576).toFixed(3);
		var pagespeed_score = response.results.pagespeed_score;
		var yslow_score = response.results.yslow_score;

		// pass the test results through scoring functions
		self.scoreBounds('Page load time: ', page_load_time, 1.5, 2.5, 'seconds');
		self.scoreBounds('Page requests:  ', page_elements, 20, 30, 'requests');
		self.scoreBounds('Page Size:      ', page_bytes, 1.0, 3.5, 'MB');
		self.pointBounds('Pagespeed score:', pagespeed_score, 80, 90, 'points');
		self.pointBounds('Yslow score:    ', yslow_score, 80, 90, 'points');

		// quit on completion
		process.exit(1);
	};

	// Pass, improve or fail functions
	self.pass = function(text, pass, units){
		gutil.log(text, gutil.colors.green(pass, units, '//##// PASS'));
	};

	self.improve = function(text, improve, units){
		gutil.log(text, gutil.colors.yellow(improve, units, '//##// IMPROVE'));
	};

	self.warning = function(text, warning, units){
		gutil.log(text, gutil.colors.red(warning, units, '//##// FAIL, PLEASE FIX'));
	};

	// Compare bounds functions
	self.scoreBounds = function(text, data, lower, upper, units){
		if(data <= lower){
			self.pass(text, data, units);
		} else if ((data > lower && data <= upper)){
			self.improve(text, data, units);
		} else {
			self.warning(text, data, units);
		}
	};

	self.pointBounds = function(text, data, lower, upper, units){
		if(data >= upper){
			self.pass(text, data, units);
		} else if ((data <= upper && data >= lower)){
			self.improve(text, data, units);
		} else {
			self.warning(text, data, units);
		}
	};

};

