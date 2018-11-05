/// <reference path="../src/JSONStream.d.ts" />
export interface Cache {
    read(key: string): Promise<any>;
    write(key: string, data: any): Promise<void>;
    delete(key: string): Promise<void>;
    flush(): Promise<void>;
}
export declare function createCache(path: string): Cache;
export declare class MemoryCache implements Cache {
    private _map;
    constructor();
    read(key: string): Promise<any>;
    write(key: string, data: any): Promise<void>;
    delete(key: string): Promise<void>;
    flush(): Promise<void>;
}
export declare class FileCache implements Cache {
    private path;
    constructor(path: string);
    read(key: string): Promise<any>;
    write(key: string, data: any): Promise<void>;
    delete(key: string): Promise<void>;
    flush(): Promise<void>;
    private _filePath(key);
}
export declare function writeArrayToDisk(items: any[], filePath: string): Promise<void>;
export declare function readArrayFromDisk(filePath: string): Promise<any[]>;
