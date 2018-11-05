/* Copyright (c) Ben Robert Mewburn
 * Licensed under the ISC Licence.
 */

'use strict';

export interface LogWriter {
    error(msg:string);
    warn(msg:string);
    info(msg:string);
}

export namespace Log {
    export var writer:LogWriter;

    export function error(msg:string) {
        if(writer && msg) {
            writer.error(msg);
        }
    }

    export function warn(msg:string) {
        if(writer && msg) {
            writer.warn(msg);
        }
    }

    export function info(msg:string) {
        if(writer && msg) {
            writer.info(msg);
        }
    }
}