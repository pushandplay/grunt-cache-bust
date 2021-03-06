'use strict';

var grunt = require('grunt');
var cheerio = require('cheerio');
var css = require('css');
var url = require('url');

var cheerioOptions = {
    ignoreWhitespace: true,
    lowerCaseTags: true
};

module.exports = function(opts) {
    var utils = require('./utils');
    var processCssFile = require('./processCssFile');
    var filters = grunt.util._.defaults(opts.filters, require('./defaultFilters'));

    return function(data, isCSS) {
        var $ = cheerio.load(data, cheerioOptions);
        var paths = [];
        var match;
        var potentialPath;

        function parseConditionalStatements() {
            var assets = '';

            // Add any conditional statements or assets in comments to the DOM
            $('head, body')
                .contents()
                .filter(function() {
                    return this.type === 'comment';
                })
                .each(function(i, element) {
                    assets += element.data.replace(/\[.*\]>|<!\[endif\]/g, '').trim();
                });

            $('body').append(assets);
        }

        if (isCSS) {
            paths = paths.concat(processCssFile(data));
        } else {
            parseConditionalStatements();
        }

        // Loop through each filter in the filter object
        function findPaths($root) {
            Object.keys(filters).forEach(function(key) {
                var mappers = filters[key];

                var addPaths = function(mapper) {
                    if ($root(key).attr('type') === 'text/template') {
                        findPaths(cheerio.load($root(key).html(), cheerioOptions));
                    }

                    var foundPaths = $root(key)
                        .filter(function(i, element) {
                            return utils.checkIfElemContainsValidFile(element, opts.cdnPath);
                        })
                        .map(mapper)
                        .filter(function(i, path) {
                            return path ? true : false;
                        });

                    for (var i = 0; i < foundPaths.length; i++) {
                        paths = paths.concat(foundPaths[i]);
                    }
                };

                if (grunt.util.kindOf(mappers) === 'array') {
                    mappers.forEach(addPaths);
                } else {
                    addPaths(mappers);
                }
            });
        }

        findPaths($);

        if (opts.enableUrlFragmentHint) {
            // Find any strings containing the hash `#grunt-cache-bust`
            var fragRegex = /'(([^']+)#grunt-cache-bust)'|"(([^"]+)#grunt-cache-bust)"/g;

            while ((match = fragRegex.exec(data)) !== null) {
                potentialPath = match[2] || match[4];

                if (utils.checkIfValidFile(url.parse(potentialPath))) {
                    paths.push(potentialPath);
                }
            }
        }

        return paths
            .filter(function(val) {
                return val !== undefined;
            })
            .map(url.parse)
            .filter(function(val) {
                return utils.checkIfValidFile(val, opts.cdnPath);
            });
    };
};
