"use strict";

var rollup = require('rollup');
var memory = require('rollup-plugin-memory');
var applySourceMap = require('vinyl-sourcemaps-apply');
var through2 = require('through2');
var extend = require('extend');
var path = require('path');
var fs = require('fs');

function resolveJs() {
	var file = path.resolve.apply(path, arguments);
	return fs.existsSync(file) ? file : fs.existsSync(file + '.js') ? file + '.js' : file;
}

function rollupStream(options, bundleCb) {
	options = options || {};
	var cache = options.cache;

	function resolveId(id, importer) {
		var rootDir = options.root || process.cwd();
		if (id.substr(0, 2) === './' || id.substr(0, 3) === '../') {
			if (!importer) throw new Error("Invalid relative import");
			return resolveJs(path.dirname(importer), id);
		} else if (id.substr(0, 1) === '/') {
			return resolveJs(id);
		}
		return resolveJs(rootDir, id);
	}
	return through2.obj(function (file, enc, callback) {
		var thisOptions = Object.assign({}, options);
		thisOptions.cache = cache;
		thisOptions.entry = file.path;
		thisOptions.plugins = [memory({ contents: file.contents.toString() })].concat(options.plugins || []).concat({ resolveId: resolveId });
		thisOptions.external = options.external;

		rollup.rollup(thisOptions).then(function (bundle) {
			cache = bundle;

			if (bundleCb) bundleCb(bundle);

			var generate = {
				format: options.format || 'cjs',
				exports: options.exports,
				moduleId: options.moduleId,
				moduleName: options.moduleName,
				globals: options.globals
			};
			if (file.sourceMap) {
				generate.sourceMap = true;
				generate.sourceMapFile = file.path;
			}
			var result = bundle.generate(generate);

			var newFile = options.clone ? file.clone() : file;
			newFile.contents = new Buffer(result.code);
			if (newFile.sourceMap) {
				result.map.file = newFile.sourceMap.file || result.map.file;
				applySourceMap(newFile, result.map);
			}

			callback(null, newFile);
		}).catch(function (err) {
			callback(err || new Error());
		});
	});
};
module.exports = rollupStream;