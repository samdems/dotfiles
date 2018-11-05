/* Copyright (c) Ben Robert Mewburn
 * Licensed under the ISC Licence.
 */

'use strict';

export namespace PhpDocParser {

    const stripPattern: RegExp = /^\/\*\*[ \t]*|\s*\*\/$|^[ \t]*\*[ \t]*/mg;
    const tagBoundaryPattern: RegExp = /(?:\r\n|\r|\n)(?=@)/;
    const summaryBoundaryPattern: RegExp = /\.(?:\r\n|\r|\n)|(?:\r\n|\r|\n){2}/;
    const whitespacePattern: RegExp = /\s+/;
    const paramOrPropertyPattern = /^(@param|@property|@property-read|@property-write)\s+(\S+)\s+(\$\S+)\s*([^]*)$/;
    const varPattern = /^(@var)\s+(\S+)(?:\s+(\$\S+))?\s*([^]*)$/;
    const returnPattern = /^(@return)\s+(\S+)\s*([^]*)$/;
    const methodPattern = /^(@method)\s+(?:(static)\s+)?(?:(\S+)\s+)?(\S+)\(\s*([^)]*)\s*\)\s*([^]*)$/;

    export function parse(input: string) {

        if (!input) {
            return null;
        }

        let stripped = input.replace(stripPattern, '');
        let split = stripped.split(tagBoundaryPattern);
        let text: string = '';

        if (split.length && split[0].indexOf('@') !== 0) {
            text = split.shift().trim();
        }

        let match: RegExpMatchArray;
        let tagString: string;
        let tags: Tag[] = [];
        let tag:Tag;

        while (tagString = split.shift()) {

            //parse @param, @var, @property*, @return, @method tags
            tag = parseTag(tagString);
            if(tag){
                tags.push(tag);
            }

        }

        //must have at least text or a tag
        if (!text && !tags.length) {
            return null;
        }

        return new PhpDoc(text, tags);

    }

    function parseTag(text:string){

        let substring = text.slice(0, 4);
        let match: RegExpMatchArray;

        switch(substring){
            case '@par':
            case '@pro':
                if((match = text.match(paramOrPropertyPattern))){
                    return typeTag(match[1], match[2], match[3], match[4]);
                }
                return null;
            case '@var':
                if((match = text.match(varPattern))){
                    return typeTag(match[1], match[2], match[3], match[4]);
                }
                return null;
            case '@ret':
                if((match = text.match(returnPattern))){
                    return typeTag(match[1], match[2], '', match[3]);
                }
                return null;
            case '@met':
                if((match = text.match(methodPattern))){
                    return methodTag(match[1], match[2], match[3], match[4], methodParameters(match[5]), match[6]);
                }
                return null;
            default:
                return null;
        }


    }

    function typeTag(tagName: string, typeString: string, name: string, description: string) {
        return {
            tagName: tagName,
            typeString: typeString,
            name: name ? name : '',
            description: description ? description : ''
        };
    }

    function methodTag(tagName: string, visibility:string, returnTypeString: string, name: string,
        parameters: MethodTagParam[], description: string) {
        return {
            tagName: tagName,
            isStatic: visibility === 'static',
            typeString: returnTypeString ? returnTypeString : 'void',
            name: name,
            parameters: parameters,
            description: description ? description : ''
        };
    }

    function methodParameters(input: string): MethodTagParam[] {

        if (!input) {
            return [];
        }

        let params: MethodTagParam[] = [];
        let paramSplit = input.split(',');
        let typeString: string, name: string;
        let param:string[];

        while (paramSplit.length) {

            param = paramSplit.pop().trim().split(whitespacePattern);
            if(param.length === 1) {
                typeString = 'mixed';
                name = param[0];
            } else if(param.length === 2) {
                typeString = param[0];
                name = param[1];
            } else {
                name = '';
            }

            if (name) {
                params.push({
                    typeString: typeString,
                    name: name
                });
            }

        }

        return params.reverse();
    }

}

export interface MethodTagParam {
    typeString: string;
    name: string;
}

export interface Tag {
    tagName: string;
    name: string;
    description: string;
    typeString: string,
    parameters?: MethodTagParam[];
    isStatic?:boolean;
}

export class PhpDoc {

    constructor(public text:string, public tags: Tag[]) { }

    get returnTag() {
        return this.tags.find(PhpDoc.isReturnTag);
    }

    get propertyTags() {
        return this.tags.filter(PhpDoc.isPropertyTag);
    }

    get methodTags() {
        return this.tags.filter(PhpDoc.isMethodTag);
    }

    get varTags() {
        return this.tags.filter(PhpDoc.isVarTag);
    }

    findParamTag(name: string) {
        let fn = (x) => {
            return x.tagName === '@param' && x.name === name;
        };
        return this.tags.find(fn);

    }

    findVarTag(name: string) {
        let fn = (x) => {
            return x.tagName === '@var' && (!x.name || name === x.name);
        };
        return this.tags.find(fn);
    }

}

export namespace PhpDoc {

    export function isPropertyTag(t: Tag) {
        return t.tagName.indexOf('@property') === 0;
    }

    export function isReturnTag(t: Tag) {
        return t.tagName === '@return';
    }

    export function isMethodTag(t: Tag) {
        return t.tagName === '@method';
    }

    export function isVarTag(t:Tag){
        return t.tagName === '@var';
    }

}