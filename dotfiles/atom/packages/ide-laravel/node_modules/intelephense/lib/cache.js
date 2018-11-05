'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs-extra");
const path = require("path");
const util = require("./util");
const logger_1 = require("./logger");
const jsonstream = require("JSONStream");
function createCache(path) {
    let cache;
    if (!path) {
        return new MemoryCache();
    }
    try {
        cache = new FileCache(path);
    }
    catch (e) {
        logger_1.Log.error('Cache error: ' + e.message);
        cache = new MemoryCache();
    }
    return cache;
}
exports.createCache = createCache;
class MemoryCache {
    constructor() {
        this._map = {};
    }
    read(key) {
        return Promise.resolve(this._map[key]);
    }
    write(key, data) {
        this._map[key] = data;
        return Promise.resolve();
    }
    delete(key) {
        delete this._map[key];
        return Promise.resolve();
    }
    flush() {
        this._map = {};
        return Promise.resolve();
    }
}
exports.MemoryCache = MemoryCache;
function writeFile(filePath, bucket) {
    return new Promise((resolve, reject) => {
        let json;
        try {
            json = JSON.stringify(bucket);
        }
        catch (e) {
            reject(e.message);
            return;
        }
        fs.writeFile(filePath, json, (err) => {
            if (err) {
                reject(err.message);
                return;
            }
            resolve();
        });
    });
}
function deleteFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.unlink(filePath, (err) => {
            if (err && err.code !== 'ENOENT') {
                reject(err.message);
                return;
            }
            resolve();
        });
    });
}
function readFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    resolve(undefined);
                }
                else {
                    reject(err.message);
                }
                return;
            }
            let bucket;
            try {
                bucket = JSON.parse(data.toString());
            }
            catch (e) {
                reject(e.message);
            }
            resolve(bucket);
        });
    });
}
function bucketFind(bucket, key) {
    return bucket.find((i) => { return i[0] === key; });
}
function bucketRemove(bucket, key) {
    return bucket.filter((b) => { return b[0] !== key; });
}
class FileCache {
    constructor(path) {
        this.path = path;
        try {
            fs.mkdirpSync(this.path);
        }
        catch (err) {
            if (err && err.code !== 'EEXIST') {
                throw err;
            }
        }
    }
    read(key) {
        let filePath = this._filePath(key);
        return readFile(filePath).then((b) => {
            let item;
            if (b && (item = bucketFind(b, key))) {
                return Promise.resolve(item[1]);
            }
            else {
                return Promise.resolve(undefined);
            }
        });
    }
    write(key, data) {
        let filePath = this._filePath(key);
        return readFile(filePath).then((b) => {
            if (b) {
                b = bucketRemove(b, key);
                b.push([key, data]);
            }
            else {
                b = [[key, data]];
            }
            return writeFile(filePath, b);
        });
    }
    delete(key) {
        let filePath = this._filePath(key);
        return readFile(filePath).then((b) => {
            let item;
            if (b && bucketFind(b, key) && b.length > 1) {
                b = bucketRemove(b, key);
                return writeFile(filePath, b);
            }
            else if (b) {
                return deleteFile(filePath);
            }
            else {
                return Promise.resolve();
            }
        });
    }
    flush() {
        return new Promise((resolve, reject) => {
            fs.emptyDir(this.path, (err) => {
                if (err) {
                    reject(err.message);
                }
                else {
                    resolve();
                }
            });
        });
    }
    _filePath(key) {
        return path.join(this.path, Math.abs(util.hash32(key)).toString(16));
    }
}
exports.FileCache = FileCache;
function writeArrayToDisk(items, filePath) {
    return new Promise((resolve, reject) => {
        let transformStream = jsonstream.stringify();
        let writeStream = fs.createWriteStream(filePath);
        transformStream.on('error', (err) => {
            logger_1.Log.error(err.message);
            reject(err.message);
        });
        transformStream.pipe(writeStream);
        writeStream.on('finish', () => {
            resolve();
        }).on('error', (err) => {
            logger_1.Log.error(err.message);
            reject(err.message);
        });
        for (let n = 0, l = items.length; n < l; ++n) {
            transformStream.write(items[n]);
        }
        transformStream.end();
    });
}
exports.writeArrayToDisk = writeArrayToDisk;
function readArrayFromDisk(filePath) {
    return new Promise((resolve, reject) => {
        let transformStream = jsonstream.parse('*');
        let readStream = fs.createReadStream(filePath);
        let items = [];
        readStream.on('error', (err) => {
            if (err && err.code !== 'ENOENT') {
                logger_1.Log.error(err.message);
                reject(err.message);
            }
            else {
                resolve(items);
            }
        });
        readStream.pipe(transformStream).on('data', (item) => {
            items.push(item);
        }).on('end', () => {
            resolve(items);
        }).on('error', (err) => {
            logger_1.Log.error(err.message);
            reject(err.message);
        });
    });
}
exports.readArrayFromDisk = readArrayFromDisk;
