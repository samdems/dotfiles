/* Copyright (c) Ben Robert Mewburn
 * Licensed under the ISC Licence.
 */
///<reference path="./JSONStream.d.ts"/>
'use strict';

import * as fs from 'fs-extra';
import * as path from 'path';
import * as util from './util';
import { Log } from './logger';
import * as jsonstream from 'JSONStream';

export interface Cache {
    read(key: string): Promise<any>;
    write(key: string, data: any): Promise<void>;
    delete(key: string): Promise<void>;
    flush(): Promise<void>;
}

export function createCache(path: string) {
    let cache: Cache;

    if(!path) {
        return new MemoryCache();
    }

    try {
        cache = new FileCache(path);
    } catch (e) {
        Log.error('Cache error: ' + e.message);
        cache = new MemoryCache();
    }
    return cache;
}

export class MemoryCache implements Cache {

    private _map: { [index: string]: any };

    constructor() {
        this._map = {};
    }

    read(key: string) {
        return Promise.resolve(this._map[key]);
    }

    write(key: string, data: any) {
        this._map[key] = data;
        return Promise.resolve();
    }

    delete(key: string) {
        delete this._map[key];
        return Promise.resolve();
    }

    flush() {
        this._map = {};
        return Promise.resolve();
    }

}

type Bucket = Item[];
type Item = [string, any];

function writeFile(filePath: string, bucket: Bucket) {
    return new Promise<void>((resolve, reject) => {

        let json: string
        try {
            json = JSON.stringify(bucket);
        } catch (e) {
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

function deleteFile(filePath: string) {
    return new Promise<void>((resolve, reject) => {
        fs.unlink(filePath, (err) => {
            if (err && err.code !== 'ENOENT') {
                reject(err.message);
                return;
            }
            resolve();
        });
    });
}

function readFile(filePath: string): Promise<Bucket> {

    return new Promise<Bucket>((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    resolve(undefined);
                } else {
                    reject(err.message);
                }
                return;
            }

            let bucket: Bucket;
            try {
                bucket = JSON.parse(data.toString());
            } catch (e) {
                reject(e.message);
            }

            resolve(bucket);
        });
    });

}

function bucketFind(bucket: Bucket, key: string) {
    return bucket.find((i) => { return i[0] === key });
}

function bucketRemove(bucket: Bucket, key: string) {
    return bucket.filter((b) => { return b[0] !== key });
}

export class FileCache implements Cache {

    constructor(private path: string) {

        try {
            fs.mkdirpSync(this.path);
        } catch (err) {
            if (err && err.code !== 'EEXIST') {
                throw err;
            }
        }
    }

    read(key: string) {
        let filePath = this._filePath(key);
        return readFile(filePath).then((b) => {
            let item: Item;
            if (b && (item = bucketFind(b, key))) {
                return Promise.resolve<any>(item[1]);
            } else {
                return Promise.resolve<any>(undefined);
            }
        });

    }

    write(key: string, data: any) {

        let filePath = this._filePath(key);
        return readFile(filePath).then((b) => {

            if (b) {
                b = bucketRemove(b, key);
                b.push([key, data]);
            } else {
                b = [[key, data]];
            }

            return writeFile(filePath, b);
        });

    }

    delete(key: string) {

        let filePath = this._filePath(key);
        return readFile(filePath).then((b) => {
            let item: Item;
            if (b && bucketFind(b, key) && b.length > 1) {
                b = bucketRemove(b, key);
                return writeFile(filePath, b);
            } else if (b) {
                return deleteFile(filePath);
            } else {
                return Promise.resolve();
            }
        });

    }

    flush() {
        return new Promise<void>((resolve, reject) => {
            fs.emptyDir(this.path, (err) => {
                if (err) {
                    reject(err.message);
                } else {
                    resolve();
                }
            });
        });
    }

    private _filePath(key: string) {
        return path.join(this.path, Math.abs(util.hash32(key)).toString(16));
    }

}


export function writeArrayToDisk(items:any[], filePath:string) {

    return new Promise<void>((resolve, reject) => {

        let transformStream = jsonstream.stringify();
        let writeStream = fs.createWriteStream(filePath);

        transformStream.on('error', (err:any) => {
            Log.error(err.message);
            reject(err.message);
        });
    
        transformStream.pipe(writeStream);

        writeStream.on('finish', () => {
            resolve();
        }).on('error', (err:any) => {
            Log.error(err.message);
            reject(err.message);
        });

        for(let n = 0, l = items.length; n < l; ++n) {
            transformStream.write(items[n]);
        }
    
        transformStream.end();
    });

}

export function readArrayFromDisk(filePath: string) {

    return new Promise<any[]>((resolve, reject) => {
        let transformStream = jsonstream.parse('*');
        let readStream = fs.createReadStream(filePath);
        let items: any[] = [];

        readStream.on('error', (err:any)=>{
            if (err && err.code !== 'ENOENT') {
                Log.error(err.message);
                reject(err.message);
            } else {
                resolve(items);
            }
        });

        readStream.pipe(transformStream).on('data', (item:any) => {
            items.push(item);
        }).on('end', () => {
            resolve(items);
        }).on('error', (err:any) => {
            Log.error(err.message);
            reject(err.message);
        });
    });

}
