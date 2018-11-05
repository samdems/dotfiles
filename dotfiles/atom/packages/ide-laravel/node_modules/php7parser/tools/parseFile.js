/*
* Manual test of file
* node parseFile.js PATH_TO_FILE
*/
var fs = require('fs');
var path = require('path');
var php = require('../lib/php7parser');
var tree;

if (process.argv.length !== 3) {
    console.log('Usage: node parseFile.js PATH_TO_FILE');
    return;
}

filepath = process.argv[2];

fs.readFile(filepath, function (err, data) {
    if (err) {
        throw err;
    }

    let dataString = data.toString();
    let hrtime = process.hrtime();
    tree = php.Parser.parse(dataString);
    let hrtimeDiff = process.hrtime(hrtime);
    console.log(JSON.stringify(tree, null, 4));
    console.log(hrtimeDiff);
    console.log(process.memoryUsage());

});
