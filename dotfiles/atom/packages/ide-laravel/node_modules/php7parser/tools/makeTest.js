/*
* Takes a php test file and creates a json file with 
* parser output for test purposes
* node makeTest.js PATH_TO_FILE
*/
var fs = require('fs');
var path = require('path');
var php = require('../lib/php7parser');
var tree;

if (process.argv.length !== 3) {
    console.log('Usage: node makeTest.js PATH_TO_FILE');
    return;
}

filepath = process.argv[2];
if (!path.isAbsolute(filepath)) {
    filepath = path.resolve(filepath);
}

fs.readFile(filepath, function (err, data) {
    if (err) {
        throw err;
    }

    let dataString = data.toString();
    let hrtime = process.hrtime();
    tree = php.Parser.parse(dataString);
    let hrtimeDiff = process.hrtime(hrtime);
    let testFilepath = filepath + '.json';

    fs.writeFile(testFilepath, JSON.stringify(tree, null, 4), function (err) {
        if (err) {
            throw err;
        }

        console.log(`Test written to ${testFilepath}`);
    });

});