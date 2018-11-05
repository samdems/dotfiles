/* Copyright (c) Ben Robert Mewburn
 * Licensed under the ISC Licence.
 */

'use strict';

import {NameResolver} from './nameResolver';
import * as util from './util';

export namespace TypeString {

    const classNamePattern: RegExp = /[$\\a-zA-Z_\x7f-\xff][\\a-zA-Z0-9_\x7f-\xff]*/g;

    const keywords: string[] = [
        'string', 'integer', 'int', 'boolean', 'bool', 'float',
        'double', 'object', 'mixed', 'array', 'resource',
        'void', 'null', 'false', 'true', 'self', 'static',
        'callable', '$this', 'real', 'iterable'
    ];

    export function atomicClassArray(typeString:string) {

        if(!typeString) {
            return [];
        }

        let classes: string[] = [];
        let types = chunk(typeString);
        let type: string;

        for (let n = 0; n < types.length; ++n) {
            type = types[n];
            if (type[type.length - 1] !== ']' && keywords.indexOf(type.toLowerCase()) < 0) {
                classes.push(type);
            }
        }

        return classes;

    }

    export function arrayDereference(typeString:string) {

        if(!typeString) {
            return '';
        }

        let dereferenced: string[] = [];
        let types = chunk(typeString);
        let type: string;

        for (let n = 0; n < types.length; ++n) {
            type = types[n];

            if (type.slice(-2) === '[]') {
                type = type.slice(0, -2);
                if (type.slice(-1) === ')') {
                    type = type.slice(1, -1);
                    Array.prototype.push.apply(dereferenced, chunk(type));
                } else {
                    dereferenced.push(type);
                }
            }

        }

        dereferenced = unique(dereferenced);
        return dereferenced.join('|');

    }

    export function arrayReference(typeString:string) {
        if(!typeString) {
            return '';
        }

        let text: string;
        let types = chunk(typeString);
        if (types.length > 1) {
            text = '(' + types.join('|') + ')[]';
        } else {
            text = types[0] + '[]';
        }
        return text;
    }

    export function merge(a: string, b:string) {

        if(!a && !b){
            return '';
        }

        if(a === b) {
            return a;
        }

        if (!a) {
            return b;
        }

        if(!b) {
            return a;
        }

        let types = chunk(a);
        Array.prototype.push.apply(types, chunk(b));
        return unique(types).join('|');
    }

    export function mergeMany(typeStrings:string[]){
        
        let type = '';
        for(let n = 0; n < typeStrings.length; ++n) {
            type = merge(type, typeStrings[n]);
        }
        return type;
    }

    export function nameResolve(typeString:string, nameResolver: NameResolver) {

        if(!typeString) {
            return '';
        }

        let replacer = (match, offset, text) => {

            let lcMatch = match.toLowerCase();

            if (lcMatch === 'self') {
                return nameResolver.className;
            } else if (keywords.indexOf(lcMatch) >= 0) {
                return match;
            } else if (match[0] === '\\') {
                return match.slice(1);
            } else {
                return nameResolver.resolveNotFullyQualified(match);
            }

        };

        return typeString.replace(classNamePattern, replacer);
    }

    export function count(typeString:string) {
        return chunk(typeString).length;
    }

    export function resolveThisOrStatic(typeString:string, fqn:string) {
        if(!typeString) {
            return '';
        }

        let replacer = (match, offset, text) => {
            let lcMatch = match.toLowerCase();
            if(lcMatch === '$this' || lcMatch === 'static') {
                return fqn;
            }
            return match;
        }

        return typeString.replace(classNamePattern, replacer);
    }

    function unique(parts: string[]) {
        let set = new Set<string>(parts);
        return Array.from(set);
    }

    function chunk(typeString: string) {

        let n = 0;
        let parentheses = 0;
        let parts: string[] = [];
        let part: string = '';
        let c: string;

        while (n < typeString.length) {

            c = typeString[n];

            switch (c) {
                case '|':
                    if (parentheses) {
                        part += c;
                    } else if (part) {
                        parts.push(part);
                        part = '';
                    }
                    break;
                case '(':
                    ++parentheses;
                    part += c;
                    break;
                case ')':
                    --parentheses;
                    part += c;
                    break;
                default:
                    part += c;
                    break;
            }

            ++n;
        }

        if (part) {
            parts.push(part);
        }

        return parts;

    }


}