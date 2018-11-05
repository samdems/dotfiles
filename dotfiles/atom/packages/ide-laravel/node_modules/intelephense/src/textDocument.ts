/* Copyright (c) Ben Robert Mewburn
 * Licensed under the ISC Licence.
 */

'use strict';

import { BinarySearch } from './types';
import { Phrase, Token } from 'php7parser';
import { Position, Range } from 'vscode-languageserver-types';

export class TextDocument {

    private _uri: string;
    private _text: string;
    private _lineOffsets: number[];

    constructor(uri: string, text: string) {
        this._uri = uri;
        this.text = text;
    }

    get uri() {
        return this._uri;
    }

    get text() {
        return this._text;
    }

    set text(text: string) {
        this._text = text;
        this._lineOffsets = this._textLineOffsets(text, 0);
    }

    get lineOffsets() {
        return this._lineOffsets;
    }

    textBeforeOffset(offset:number, length:number){
        let start = Math.min(offset - (length - 1), 0);
        return this._text.slice(start, offset + 1);
    }

    lineText(line:number){
        let endOffset = line + 1 < this._lineOffsets.length ? 
            this._lineOffsets[line + 1] : this._text.length;
        return this._text.slice(this._lineOffsets[line], endOffset);
    }

    lineAtOffset(offset:number){
        let search = new BinarySearch<number>(this._lineOffsets);
        let compareFn = (x) => {
            return x - offset;
        };
        let result = search.search(compareFn);
        return result.isExactMatch ? result.rank : Math.max(result.rank - 1, 0);
    }

    lineSubstring(offset:number){
        let lineNumber = this.lineAtOffset(offset);
        return this._text.slice(this._lineOffsets[lineNumber], offset);
    }

    offsetAtLine(line: number) {

        if (line <= 0 || this._lineOffsets.length < 1) {
            return 0;
        } else if (line > this._lineOffsets.length - 1) {
            return this._lineOffsets[this._lineOffsets.length - 1];
        } else {
            return this._lineOffsets[line];
        }
    }

    textAtOffset(offset: number, length: number) {
        return this._text.substr(offset, length);
    }

    positionAtOffset(offset: number) {

        let index = this.lineAtOffset(offset);

        return <Position>{
            line: index,
            character: offset - this._lineOffsets[index]
        };

    }

    offsetAtPosition(pos: Position) {
        let offset = this.offsetAtLine(pos.line) + pos.character;
        return Math.max(0, Math.min(offset, this._text.length));
    }

    applyEdit(start: Position, end: Position, text: string) {

        let startOffset = this.offsetAtPosition(start);
        let endOffset = this.offsetAtPosition(end);
        this._text = this._text.slice(0, startOffset) + text + this._text.slice(endOffset);
        let newLineOffsets = this._lineOffsets.slice(0, start.line + 1);
        let lengthDiff = text.length - (endOffset - startOffset);
        Array.prototype.push.apply(newLineOffsets, this._textLineOffsets(text, startOffset).slice(1));
        let endLineOffsets = this._lineOffsets.slice(end.line + 1);
        
        for(let n = 0, l = endLineOffsets.length; n < l; ++n){
            newLineOffsets.push(endLineOffsets[n] + lengthDiff);
        }

        this._lineOffsets = newLineOffsets;
    }

    private _textLineOffsets(text: string, offset: number) {

        let n = 0;
        let length = text.length;
        let isLineStart = true;
        let offsets = [];
        let c: string;

        while (n < length) {

            c = text[n];

            if (isLineStart) {
                offsets.push(n + offset);
                isLineStart = false;
            }

            if (c === '\r') {
                if (++n < length && text[n] === '\n') {
                    ++n;
                }
                isLineStart = true;
                continue;
            } else if (c === '\n') {
                isLineStart = true;
            }

            ++n;

        }

        if (isLineStart) {
            offsets.push(n + offset);
        }

        return offsets;

    }

}

