//converts json tree phrase and token constants to names
var fs = require('fs');
var path = require('path');
var php = require('../lib/php7parser');
var tree;

if (process.argv.length !== 3) {
    console.log('Usage: node toNamedJsonTree.js PATH_TO_FILE');
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

    tree = JSON.parse(data.toString());
    let replacer = (key, value) => {
        if(key === 'phraseType') {
            return php.phraseTypeToString(value);
        } else if(key === 'tokenType' || key === 'expected') {
            return php.tokenTypeToString(value);
        } else {
            return value;
        }
    }

    console.log(JSON.stringify(tree, replacer, 4));

});