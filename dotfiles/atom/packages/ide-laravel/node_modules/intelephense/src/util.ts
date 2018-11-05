/* Copyright (c) Ben Robert Mewburn
 * Licensed under the ISC Licence.
 */

'use strict';

import { Position, Range, Location } from 'vscode-languageserver-types';
import { Predicate } from './types';

export function popMany<T>(array: T[], count: number) {
    let popped: T[] = [];
    while (count--) {
        popped.push(array.pop());
    }
    return popped.reverse();
}

export function top<T>(array: T[]) {
    return array.length ? array[array.length - 1] : null;
}

export function isString(s: any) {
    return typeof (s) === 'string' || s instanceof String;
}

export function isInRange(position: Position, range: Range) {

    let start = range.start;
    let end = range.end;

    if (position.line < start.line ||
        (position.line === start.line && position.character < start.character)) {
        return -1;
    }

    if (position.line > end.line ||
        (position.line === end.line && position.character > end.character)) {
        return 1;
    }

    return 0;

}

export function positionEquality(p1: Position, p2: Position) {
    return p1 && p2 && p1.character === p2.character && p1.line === p2.line;
}

export function rangeEquality(r1: Range, r2: Range) {
    return r1 && r2 && positionEquality(r1.start, r2.start) && positionEquality(r1.end, r2.end);
}

export function acronym(text: string) {

    if (!text) {
        return '';
    }

    let lcText = text.toLowerCase();
    let n = 0;
    let l = text.length;
    let c: string;
    let acronym = lcText[0] !== '_' && lcText[0] !== '$' ? lcText[0] : '';

    while (n < l) {

        c = text[n];

        if ((c === '$' || c === '_') && n + 1 < l && text[n + 1] !== '_') {
            ++n;
            acronym += lcText[n];
        } else if (n > 0 && c !== lcText[n] && text[n - 1] === lcText[n - 1]) {
            //uppercase
            acronym += lcText[n];
        }

        ++n;

    }

    return acronym;
}

export function trigrams(text: string) {

    if (text.length < 3) {
        return new Set<string>();
    }

    //text = text.toLowerCase();
    let trigrams: Set<string> = new Set();

    for (let n = 0, l = text.length - 2; n < l; ++n) {
        trigrams.add(text.substr(n, 3));
    }

    return trigrams;
}

export function ciStringContains(query: string, subject: string) {
    if (!query) {
        return true;
    }

    return subject.toLowerCase().indexOf(query.toLowerCase()) > -1

}

export function ciStringMatch(a: string, b: string) {
    return a.toLowerCase() === b.toLowerCase();
}

export function whitespace(n: number) {
    return new Array(n).fill(' ').join('');
}

/**
 * http://stackoverflow.com/a/7616484
 */
export function hash32(text: string) {
    let hash = 0;
    let chr: number;
    for (let i = 0, l = text.length; i < l; ++i) {
        chr = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}

export function filter<T>(items: T[], fn: Predicate<T>) {

    let filtered: T[] = [];

    if (!items) {
        return filtered;
    }

    let item: T;
    for (let n = 0, l = items.length; n < l; ++n) {
        item = items[n];
        if (fn(item)) {
            filtered.push(item);
        }
    }

    return filtered;

}

export function find<T>(items: T[], fn: Predicate<T>) {

    if (!items) {
        return undefined;
    }

    let item: T;
    for (let n = 0, l = items.length; n < l; ++n) {
        item = items[n];
        if (fn(item)) {
            return item;
        }
    }

    return undefined;
}

export function cloneRange(range: Range): Range {
    return Range.create(
        range.start.line,
        range.start.character,
        range.end.line,
        range.end.character
    );
}