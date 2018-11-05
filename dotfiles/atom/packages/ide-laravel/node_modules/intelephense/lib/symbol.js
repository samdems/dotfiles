'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const util = require("./util");
var PhpSymbolDoc;
(function (PhpSymbolDoc) {
    function create(description, type) {
        return {
            description: description || '',
            type: type || ''
        };
    }
    PhpSymbolDoc.create = create;
})(PhpSymbolDoc = exports.PhpSymbolDoc || (exports.PhpSymbolDoc = {}));
var PhpSymbol;
(function (PhpSymbol) {
    function keys(s) {
        if (!s.name) {
            return [];
        }
        if (s.kind === 512) {
            return [s.name.toLowerCase()];
        }
        let text = notFqn(s.name);
        let lcText = text.toLowerCase();
        let suffixes = [s.name.toLowerCase()];
        if (text !== s.name) {
            suffixes.push(lcText);
        }
        let n = 0;
        let c;
        let l = text.length;
        while (n < l) {
            c = text[n];
            if ((c === '$' || c === '_') && n + 1 < l && text[n + 1] !== '_') {
                ++n;
                suffixes.push(lcText.slice(n));
            }
            else if (n > 0 && c !== lcText[n] && text[n - 1] === lcText[n - 1]) {
                suffixes.push(lcText.slice(n));
            }
            ++n;
        }
        return suffixes;
    }
    PhpSymbol.keys = keys;
    function isParameter(s) {
        return s.kind === 128;
    }
    function isClassLike(s) {
        return (s.kind & (1 | 2 | 4)) > 0;
    }
    PhpSymbol.isClassLike = isClassLike;
    function signatureString(s, excludeTypeInfo) {
        if (!s || !(s.kind & (64 | 32))) {
            return '';
        }
        const params = s.children ? s.children.filter(isParameter) : [];
        const paramStrings = [];
        let param;
        let parts;
        let paramType;
        let closeBrackets = '';
        for (let n = 0, l = params.length; n < l; ++n) {
            param = params[n];
            parts = [];
            if (n) {
                parts.push(',');
            }
            if (!excludeTypeInfo) {
                paramType = PhpSymbol.type(param);
                if (paramType) {
                    parts.push(paramType);
                }
            }
            parts.push(param.name);
            if (param.value) {
                const space = n ? ' ' : '';
                paramStrings.push(`${space}[${parts.join(' ')}`);
                closeBrackets += ']';
            }
            else {
                paramStrings.push(parts.join(' '));
            }
        }
        let sig = `(${paramStrings.join('')}${closeBrackets})`;
        if (!excludeTypeInfo) {
            const sType = PhpSymbol.type(s);
            if (sType) {
                sig += `: ${sType}`;
            }
        }
        return sig;
    }
    PhpSymbol.signatureString = signatureString;
    function hasParameters(s) {
        return s.children && s.children.find(isParameter) !== undefined;
    }
    PhpSymbol.hasParameters = hasParameters;
    function notFqn(text) {
        if (!text) {
            return text;
        }
        let pos = text.lastIndexOf('\\') + 1;
        return text.slice(pos);
    }
    PhpSymbol.notFqn = notFqn;
    function namespace(fqn) {
        if (!fqn) {
            return '';
        }
        let pos = fqn.lastIndexOf('\\');
        return pos < 0 ? '' : fqn.slice(0, pos);
    }
    PhpSymbol.namespace = namespace;
    function clone(s) {
        return {
            kind: s.kind,
            name: s.name,
            children: s.children,
            location: s.location,
            modifiers: s.modifiers,
            associated: s.associated,
            type: s.type,
            doc: s.doc,
            scope: s.scope,
            value: s.value
        };
    }
    PhpSymbol.clone = clone;
    function type(s) {
        if (s.type) {
            return s.type;
        }
        else if (s.doc && s.doc.type) {
            return s.doc.type;
        }
        else {
            return '';
        }
    }
    PhpSymbol.type = type;
    function setScope(symbols, scope) {
        if (!symbols) {
            return symbols;
        }
        for (let n = 0; n < symbols.length; ++n) {
            symbols[n].scope = scope;
        }
        return symbols;
    }
    PhpSymbol.setScope = setScope;
    function create(kind, name, location) {
        return {
            kind: kind,
            name: name,
            location: location
        };
    }
    PhpSymbol.create = create;
    function filterChildren(parent, fn) {
        if (!parent || !parent.children) {
            return [];
        }
        return util.filter(parent.children, fn);
    }
    PhpSymbol.filterChildren = filterChildren;
    function findChild(parent, fn) {
        if (!parent || !parent.children) {
            return undefined;
        }
        return util.find(parent.children, fn);
    }
    PhpSymbol.findChild = findChild;
    function isAssociated(symbol, name) {
        let lcName = name.toLowerCase();
        let fn = (x) => {
            return lcName === x.name.toLowerCase();
        };
        return util.find(symbol.associated, fn);
    }
    PhpSymbol.isAssociated = isAssociated;
    function unique(symbols) {
        let uniqueSymbols = [];
        if (!symbols) {
            return uniqueSymbols;
        }
        let map = {};
        let s;
        for (let n = 0, l = symbols.length; n < l; ++n) {
            s = symbols[n];
            if (!(map[s.name] & s.kind)) {
                uniqueSymbols.push(s);
                map[s.name] |= s.kind;
            }
        }
        return uniqueSymbols;
    }
    PhpSymbol.unique = unique;
})(PhpSymbol = exports.PhpSymbol || (exports.PhpSymbol = {}));
class UniqueSymbolSet {
    constructor() {
        this._map = {};
        this._symbols = [];
    }
    add(s) {
        if (!this.has(s)) {
            this._symbols.push(s);
            this._map[s.name] |= s.kind;
        }
    }
    has(s) {
        return (this._map[s.name] & s.kind) === s.kind;
    }
    toArray() {
        return this._symbols.slice(0);
    }
}
exports.UniqueSymbolSet = UniqueSymbolSet;
