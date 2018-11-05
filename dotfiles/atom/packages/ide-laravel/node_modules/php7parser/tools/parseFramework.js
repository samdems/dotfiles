/*
* Manual test of framework parsing
* node parseFramework.js PATH_TO_CODE_ROOT_DIR
*/
var fs = require('fs');
var path = require('path');
var php = require('../lib/php7parser');

var count = 0;
var done = 0;
var elapsed = 0;
var errors = 0;
var errFiles = [];

if (process.argv.length !== 3) {
    console.log('Usage: node parseFramework.js PATH_TO_CODE_ROOT_DIR');
    return;
}

var pathToCodeRootDir = process.argv[2];
if (!path.isAbsolute(pathToCodeRootDir)) {
    pathToCodeRootDir = path.resolve(pathToCodeRootDir);
}

function hasErrorRecurse(node, filepath) {
    if (node.phraseType === 60) {
        //throw new Error(JSON.stringify(node, function(k,v){ return isNaN(k) && keys.indexOf(k) < 0 ? undefined : v; }, 4));
        console.log('ERROR');
        console.log(JSON.stringify(node, null, 4));
        errors++;
        errFiles.push(filepath);
    }

    if (node.children) {
        for (let n = 0; n < node.children.length; ++n) {
            hasErrorRecurse(node.children[n], filepath);
        }
    }
}

function parseRecurse(dir) {

    fs.readdir(dir, function (err, list) {
        if (err) {
            throw err;
        }

        list.forEach(function (file) {
            var filepath = path.join(dir, file);

            fs.stat(filepath, function (statErr, stat) {
                if (statErr) {
                    throw statErr;
                }

                if (stat && stat.isDirectory()) {
                    parseRecurse(filepath);
                }
                else if (path.extname(filepath) === '.php') {
                    ++count;
                    fs.readFile(filepath, function (fileErr, data) {
                        if (fileErr) {
                            throw fileErr;
                        }
                        console.log('parsing ' + filepath);
                        let dataString = data.toString();
                        //console.log(process.memoryUsage());
                        let hrTime = process.hrtime();
                        let tree = php.Parser.parse(dataString);
                        let hrTimeDiff = process.hrtime(hrTime);
                        //console.log(hrTimeDiff);
                        //console.log(process.memoryUsage());
                        elapsed += hrTimeDiff[1] + hrTimeDiff[0] * 1000000000;
                        hasErrorRecurse(tree, filepath);
                        ++done;
                        if (count === done) {
                            console.log(count + ' files parsed');
                            console.log(errors + ' errors');
                            console.log(JSON.stringify(errFiles, null, 4));
                            console.log('elapsed: ' + Math.round(elapsed / 1000000) + ' ms');
                        }
                    });
                }
            });
        });
    });
};

parseRecurse(pathToCodeRootDir);
