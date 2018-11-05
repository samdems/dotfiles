'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var TypeString;
(function (TypeString) {
    const classNamePattern = /[$\\a-zA-Z_\x7f-\xff][\\a-zA-Z0-9_\x7f-\xff]*/g;
    const keywords = [
        'string', 'integer', 'int', 'boolean', 'bool', 'float',
        'double', 'object', 'mixed', 'array', 'resource',
        'void', 'null', 'false', 'true', 'self', 'static',
        'callable', '$this', 'real', 'iterable'
    ];
    function atomicClassArray(typeString) {
        if (!typeString) {
            return [];
        }
        let classes = [];
        let types = chunk(typeString);
        let type;
        for (let n = 0; n < types.length; ++n) {
            type = types[n];
            if (type[type.length - 1] !== ']' && keywords.indexOf(type.toLowerCase()) < 0) {
                classes.push(type);
            }
        }
        return classes;
    }
    TypeString.atomicClassArray = atomicClassArray;
    function arrayDereference(typeString) {
        if (!typeString) {
            return '';
        }
        let dereferenced = [];
        let types = chunk(typeString);
        let type;
        for (let n = 0; n < types.length; ++n) {
            type = types[n];
            if (type.slice(-2) === '[]') {
                type = type.slice(0, -2);
                if (type.slice(-1) === ')') {
                    type = type.slice(1, -1);
                    Array.prototype.push.apply(dereferenced, chunk(type));
                }
                else {
                    dereferenced.push(type);
                }
            }
        }
        dereferenced = unique(dereferenced);
        return dereferenced.join('|');
    }
    TypeString.arrayDereference = arrayDereference;
    function arrayReference(typeString) {
        if (!typeString) {
            return '';
        }
        let text;
        let types = chunk(typeString);
        if (types.length > 1) {
            text = '(' + types.join('|') + ')[]';
        }
        else {
            text = types[0] + '[]';
        }
        return text;
    }
    TypeString.arrayReference = arrayReference;
    function merge(a, b) {
        if (!a && !b) {
            return '';
        }
        if (a === b) {
            return a;
        }
        if (!a) {
            return b;
        }
        if (!b) {
            return a;
        }
        let types = chunk(a);
        Array.prototype.push.apply(types, chunk(b));
        return unique(types).join('|');
    }
    TypeString.merge = merge;
    function mergeMany(typeStrings) {
        let type = '';
        for (let n = 0; n < typeStrings.length; ++n) {
            type = merge(type, typeStrings[n]);
        }
        return type;
    }
    TypeString.mergeMany = mergeMany;
    function nameResolve(typeString, nameResolver) {
        if (!typeString) {
            return '';
        }
        let replacer = (match, offset, text) => {
            let lcMatch = match.toLowerCase();
            if (lcMatch === 'self') {
                return nameResolver.className;
            }
            else if (keywords.indexOf(lcMatch) >= 0) {
                return match;
            }
            else if (match[0] === '\\') {
                return match.slice(1);
            }
            else {
                return nameResolver.resolveNotFullyQualified(match);
            }
        };
        return typeString.replace(classNamePattern, replacer);
    }
    TypeString.nameResolve = nameResolve;
    function count(typeString) {
        return chunk(typeString).length;
    }
    TypeString.count = count;
    function resolveThisOrStatic(typeString, fqn) {
        if (!typeString) {
            return '';
        }
        let replacer = (match, offset, text) => {
            let lcMatch = match.toLowerCase();
            if (lcMatch === '$this' || lcMatch === 'static') {
                return fqn;
            }
            return match;
        };
        return typeString.replace(classNamePattern, replacer);
    }
    TypeString.resolveThisOrStatic = resolveThisOrStatic;
    function unique(parts) {
        let set = new Set(parts);
        return Array.from(set);
    }
    function chunk(typeString) {
        let n = 0;
        let parentheses = 0;
        let parts = [];
        let part = '';
        let c;
        while (n < typeString.length) {
            c = typeString[n];
            switch (c) {
                case '|':
                    if (parentheses) {
                        part += c;
                    }
                    else if (part) {
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
})(TypeString = exports.TypeString || (exports.TypeString = {}));
