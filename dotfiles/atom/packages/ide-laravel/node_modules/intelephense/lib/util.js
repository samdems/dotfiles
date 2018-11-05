'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
function popMany(array, count) {
    let popped = [];
    while (count--) {
        popped.push(array.pop());
    }
    return popped.reverse();
}
exports.popMany = popMany;
function top(array) {
    return array.length ? array[array.length - 1] : null;
}
exports.top = top;
function isString(s) {
    return typeof (s) === 'string' || s instanceof String;
}
exports.isString = isString;
function isInRange(position, range) {
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
exports.isInRange = isInRange;
function positionEquality(p1, p2) {
    return p1 && p2 && p1.character === p2.character && p1.line === p2.line;
}
exports.positionEquality = positionEquality;
function rangeEquality(r1, r2) {
    return r1 && r2 && positionEquality(r1.start, r2.start) && positionEquality(r1.end, r2.end);
}
exports.rangeEquality = rangeEquality;
function acronym(text) {
    if (!text) {
        return '';
    }
    let lcText = text.toLowerCase();
    let n = 0;
    let l = text.length;
    let c;
    let acronym = lcText[0] !== '_' && lcText[0] !== '$' ? lcText[0] : '';
    while (n < l) {
        c = text[n];
        if ((c === '$' || c === '_') && n + 1 < l && text[n + 1] !== '_') {
            ++n;
            acronym += lcText[n];
        }
        else if (n > 0 && c !== lcText[n] && text[n - 1] === lcText[n - 1]) {
            acronym += lcText[n];
        }
        ++n;
    }
    return acronym;
}
exports.acronym = acronym;
function trigrams(text) {
    if (text.length < 3) {
        return new Set();
    }
    let trigrams = new Set();
    for (let n = 0, l = text.length - 2; n < l; ++n) {
        trigrams.add(text.substr(n, 3));
    }
    return trigrams;
}
exports.trigrams = trigrams;
function ciStringContains(query, subject) {
    if (!query) {
        return true;
    }
    return subject.toLowerCase().indexOf(query.toLowerCase()) > -1;
}
exports.ciStringContains = ciStringContains;
function ciStringMatch(a, b) {
    return a.toLowerCase() === b.toLowerCase();
}
exports.ciStringMatch = ciStringMatch;
function whitespace(n) {
    return new Array(n).fill(' ').join('');
}
exports.whitespace = whitespace;
function hash32(text) {
    let hash = 0;
    let chr;
    for (let i = 0, l = text.length; i < l; ++i) {
        chr = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return hash;
}
exports.hash32 = hash32;
function filter(items, fn) {
    let filtered = [];
    if (!items) {
        return filtered;
    }
    let item;
    for (let n = 0, l = items.length; n < l; ++n) {
        item = items[n];
        if (fn(item)) {
            filtered.push(item);
        }
    }
    return filtered;
}
exports.filter = filter;
function find(items, fn) {
    if (!items) {
        return undefined;
    }
    let item;
    for (let n = 0, l = items.length; n < l; ++n) {
        item = items[n];
        if (fn(item)) {
            return item;
        }
    }
    return undefined;
}
exports.find = find;
function cloneRange(range) {
    return vscode_languageserver_types_1.Range.create(range.start.line, range.start.character, range.end.line, range.end.character);
}
exports.cloneRange = cloneRange;
