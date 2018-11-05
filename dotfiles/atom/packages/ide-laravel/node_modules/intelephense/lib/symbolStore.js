'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const symbol_1 = require("./symbol");
const types_1 = require("./types");
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
const typeString_1 = require("./typeString");
const builtInSymbols = require("./builtInSymbols.json");
const symbolReader_1 = require("./symbolReader");
const nameResolver_1 = require("./nameResolver");
const util = require("./util");
const typeAggregate_1 = require("./typeAggregate");
const builtInsymbolsUri = 'php';
class SymbolTable {
    constructor(uri, root, hash) {
        this._uri = uri;
        this._root = root;
        if (hash !== undefined) {
            this._hash = hash;
        }
        else {
            this._hash = Math.abs(util.hash32(uri));
        }
    }
    get uri() {
        return this._uri;
    }
    get root() {
        return this._root;
    }
    get hash() {
        return this._hash;
    }
    get symbols() {
        let traverser = new types_1.TreeTraverser([this.root]);
        let symbols = traverser.toArray();
        symbols.shift();
        return symbols;
    }
    get symbolCount() {
        let traverser = new types_1.TreeTraverser([this.root]);
        return traverser.count() - 1;
    }
    pruneScopedVars() {
        let visitor = new ScopedVariablePruneVisitor();
        this.traverse(visitor);
    }
    parent(s) {
        let traverser = new types_1.TreeTraverser([this.root]);
        let fn = (x) => {
            return x === s;
        };
        if (!traverser.find(fn)) {
            return null;
        }
        return traverser.parent();
    }
    traverse(visitor) {
        let traverser = new types_1.TreeTraverser([this.root]);
        traverser.traverse(visitor);
        return visitor;
    }
    createTraverser() {
        return new types_1.TreeTraverser([this.root]);
    }
    filter(predicate) {
        let traverser = new types_1.TreeTraverser([this.root]);
        return traverser.filter(predicate);
    }
    find(predicate) {
        let traverser = new types_1.TreeTraverser([this.root]);
        return traverser.find(predicate);
    }
    nameResolver(pos) {
        let nameResolver = new nameResolver_1.NameResolver();
        let traverser = new types_1.TreeTraverser([this.root]);
        let visitor = new NameResolverVisitor(pos, nameResolver);
        traverser.traverse(visitor);
        return nameResolver;
    }
    scope(pos) {
        let traverser = new types_1.TreeTraverser([this.root]);
        let visitor = new ScopeVisitor(pos, false);
        traverser.traverse(visitor);
        return visitor.scope;
    }
    absoluteScope(pos) {
        let traverser = new types_1.TreeTraverser([this.root]);
        let visitor = new ScopeVisitor(pos, true);
        traverser.traverse(visitor);
        return visitor.scope;
    }
    scopeSymbols() {
        return this.filter(this._isScopeSymbol);
    }
    symbolAtPosition(position) {
        let pred = (x) => {
            return x.location && util.positionEquality(x.location.range.start, position);
        };
        return this.filter(pred).pop();
    }
    contains(s) {
        let traverser = new types_1.TreeTraverser([this.root]);
        let visitor = new ContainsVisitor(s);
        traverser.traverse(visitor);
        return visitor.found;
    }
    _isScopeSymbol(s) {
        const mask = 1 | 2 | 4 | 0 | 64 | 32;
        return (s.kind & mask) > 0;
    }
    static fromJSON(data) {
        return new SymbolTable(data._uri, data._root, data._hash);
    }
    static create(parsedDocument, externalOnly) {
        let symbolReader = new symbolReader_1.SymbolReader(parsedDocument, new nameResolver_1.NameResolver());
        parsedDocument.traverse(symbolReader);
        return new SymbolTable(parsedDocument.uri, symbolReader.symbol);
    }
    static readBuiltInSymbols() {
        return new SymbolTable(builtInsymbolsUri, {
            kind: 0,
            name: '',
            children: builtInSymbols
        });
    }
}
exports.SymbolTable = SymbolTable;
class ScopedVariablePruneVisitor {
    preorder(node, spine) {
        if ((node.kind === 64 || node.kind === 32) && node.children) {
            node.children = node.children.filter(this._isNotVar);
        }
        return true;
    }
    _isNotVar(s) {
        return s.kind !== 256;
    }
}
class SymbolStore {
    constructor() {
        this.onParsedDocumentChange = (args) => {
            this.remove(args.parsedDocument.uri);
            let table = SymbolTable.create(args.parsedDocument);
            this.add(table);
        };
        this._tableIndex = new SymbolTableIndex();
        this._symbolIndex = new types_1.NameIndex(symbol_1.PhpSymbol.keys);
        this._symbolCount = 0;
    }
    getSymbolTable(uri) {
        return this._tableIndex.find(uri);
    }
    get tables() {
        return this._tableIndex.tables();
    }
    get tableCount() {
        return this._tableIndex.count();
    }
    get symbolCount() {
        return this._symbolCount;
    }
    add(symbolTable) {
        this.remove(symbolTable.uri);
        this._tableIndex.add(symbolTable);
        this._symbolIndex.addMany(this._indexSymbols(symbolTable.root));
        this._symbolCount += symbolTable.symbolCount;
    }
    remove(uri) {
        let symbolTable = this._tableIndex.remove(uri);
        if (!symbolTable) {
            return;
        }
        this._symbolIndex.removeMany(this._indexSymbols(symbolTable.root));
        this._symbolCount -= symbolTable.symbolCount;
    }
    toJSON() {
        return {
            _tableIndex: this._tableIndex,
            _symbolCount: this._symbolCount
        };
    }
    fromJSON(data) {
        this._symbolCount = data._symbolCount;
        this._tableIndex.fromJSON(data._tableIndex);
        for (let t of this._tableIndex.tables()) {
            this._symbolIndex.addMany(this._indexSymbols(t.root));
        }
    }
    find(text, filter) {
        if (!text) {
            return [];
        }
        let lcText = text.toLowerCase();
        let kindMask = 8 | 256;
        let result = this._symbolIndex.find(text);
        let symbols = [];
        let s;
        for (let n = 0, l = result.length; n < l; ++n) {
            s = result[n];
            if ((!filter || filter(s)) &&
                (((s.kind & kindMask) > 0 && s.name === text) ||
                    (!(s.kind & kindMask) && s.name.toLowerCase() === lcText))) {
                symbols.push(s);
            }
        }
        return symbols;
    }
    match(text, filter) {
        if (!text) {
            return [];
        }
        let matches = this._symbolIndex.match(text);
        if (!filter) {
            return matches;
        }
        let filtered = [];
        let s;
        for (let n = 0, l = matches.length; n < l; ++n) {
            s = matches[n];
            if (filter(s)) {
                filtered.push(s);
            }
        }
        return filtered;
    }
    *matchIterator(text, filter) {
        if (!text) {
            return;
        }
        const indexMatchIterator = this._symbolIndex.matchIterator(text);
        const symbols = new Set();
        for (let s of indexMatchIterator) {
            if ((!filter || filter(s)) && !symbols.has(s)) {
                symbols.add(s);
                yield s;
            }
        }
    }
    findSymbolsByReference(ref, memberMergeStrategy) {
        if (!ref) {
            return [];
        }
        let symbols;
        let fn;
        let lcName;
        let table;
        switch (ref.kind) {
            case 1:
            case 2:
            case 4:
                fn = (x) => {
                    return (x.kind & (1 | 2 | 4)) > 0;
                };
                symbols = this.find(ref.name, fn);
                break;
            case 64:
            case 8:
                fn = (x) => {
                    return x.kind === ref.kind;
                };
                symbols = this.find(ref.name, fn);
                if (symbols.length < 1 && ref.altName) {
                    symbols = this.find(ref.altName, fn);
                }
                break;
            case 32:
                lcName = ref.name.toLowerCase();
                fn = (x) => {
                    return x.kind === 32 && x.name.toLowerCase() === lcName;
                };
                symbols = this.findMembers(ref.scope, memberMergeStrategy || 0, fn);
                break;
            case 16:
                {
                    let name = ref.name;
                    fn = (x) => {
                        return x.kind === 16 && name === x.name;
                    };
                    symbols = this.findMembers(ref.scope, memberMergeStrategy || 0, fn);
                    break;
                }
            case 1024:
                fn = (x) => {
                    return x.kind === 1024 && x.name === ref.name;
                };
                symbols = this.findMembers(ref.scope, memberMergeStrategy || 0, fn);
                break;
            case 256:
            case 128:
                table = this.getSymbolTable(ref.location.uri);
                if (table) {
                    let scope = table.scope(ref.location.range.start);
                    fn = (x) => {
                        return (x.kind & (128 | 256)) > 0 &&
                            x.name === ref.name;
                    };
                    let s = scope.children ? scope.children.find(fn) : null;
                    if (s) {
                        symbols = [s];
                    }
                }
                break;
            case 2048:
                fn = (x) => {
                    return x.kind === 32 && x.name.toLowerCase() === '__construct';
                };
                symbols = this.findMembers(ref.name, memberMergeStrategy || 0, fn);
                break;
            default:
                break;
        }
        return symbols || [];
    }
    findMembers(scope, memberMergeStrategy, predicate) {
        let fqnArray = typeString_1.TypeString.atomicClassArray(scope);
        let type;
        let members = [];
        for (let n = 0; n < fqnArray.length; ++n) {
            type = typeAggregate_1.TypeAggregate.create(this, fqnArray[n]);
            if (type) {
                Array.prototype.push.apply(members, type.members(memberMergeStrategy, predicate));
            }
        }
        return Array.from(new Set(members));
    }
    findBaseMember(symbol) {
        if (!symbol || !symbol.scope ||
            !(symbol.kind & (16 | 32 | 1024)) ||
            (symbol.modifiers & 4) > 0) {
            return symbol;
        }
        let fn;
        if (symbol.kind === 32) {
            let name = symbol.name.toLowerCase();
            fn = (s) => {
                return s.kind === symbol.kind && s.modifiers === symbol.modifiers && name === s.name.toLowerCase();
            };
        }
        else {
            fn = (s) => {
                return s.kind === symbol.kind && s.modifiers === symbol.modifiers && symbol.name === s.name;
            };
        }
        return this.findMembers(symbol.scope, 3, fn).shift() || symbol;
    }
    symbolLocation(symbol) {
        let table = this._tableIndex.findBySymbol(symbol);
        return table ? vscode_languageserver_types_1.Location.create(table.uri, symbol.location.range) : undefined;
    }
    referenceToTypeString(ref) {
        if (!ref) {
            return '';
        }
        switch (ref.kind) {
            case 1:
            case 2:
            case 4:
            case 2048:
                return ref.name;
            case 64:
            case 32:
            case 16:
                return this.findSymbolsByReference(ref, 2).reduce((carry, val) => {
                    return typeString_1.TypeString.merge(carry, symbol_1.PhpSymbol.type(val));
                }, '');
            case 256:
                return ref.type || '';
            default:
                return '';
        }
    }
    _sortMatches(query, matches) {
        let map = {};
        let s;
        let name;
        let val;
        query = query.toLowerCase();
        for (let n = 0, l = matches.length; n < l; ++n) {
            s = matches[n];
            name = s.name;
            if (map[name] === undefined) {
                val = (symbol_1.PhpSymbol.notFqn(s.name).toLowerCase().indexOf(query) + 1) * 10;
                if (val > 0) {
                    val = 1000 - val;
                }
                map[name] = val;
            }
            ++map[name];
        }
        let unique = Array.from(new Set(matches));
        let sortFn = (a, b) => {
            return map[b.name] - map[a.name];
        };
        unique.sort(sortFn);
        return unique;
    }
    _classOrInterfaceFilter(s) {
        return (s.kind & (1 | 2)) > 0;
    }
    _classInterfaceTraitFilter(s) {
        return (s.kind & (1 | 2 | 4)) > 0;
    }
    _indexSymbols(root) {
        let traverser = new types_1.TreeTraverser([root]);
        return traverser.filter(this._indexFilter);
    }
    _indexFilter(s) {
        return !(s.kind & (128 | 4096)) &&
            !(s.modifiers & 4096) &&
            !(s.kind === 256 && s.location) &&
            s.name.length > 0;
    }
}
exports.SymbolStore = SymbolStore;
class NameResolverVisitor {
    constructor(pos, nameResolver) {
        this.pos = pos;
        this.nameResolver = nameResolver;
        this.haltTraverse = false;
        this._kindMask = 1 | 64 | 8;
    }
    preorder(node, spine) {
        if (node.location && node.location.range.start.line > this.pos.line) {
            this.haltTraverse = true;
            return false;
        }
        if ((node.modifiers & 4096) > 0 && (node.kind & this._kindMask) > 0) {
            this.nameResolver.rules.push(node);
        }
        else if (node.kind === 512) {
            this.nameResolver.namespace = node;
        }
        else if (node.kind === 1) {
            this.nameResolver.pushClass(node);
        }
        return true;
    }
    postorder(node, spine) {
        if (this.haltTraverse || (node.location && node.location.range.end.line > this.pos.line)) {
            this.haltTraverse = true;
            return;
        }
        if (node.kind === 1) {
            this.nameResolver.popClass();
        }
    }
}
class ScopeVisitor {
    constructor(pos, absolute) {
        this.pos = pos;
        this.haltTraverse = false;
        this._kindMask = 1 | 2 | 4 | 64 | 32 | 4096;
        this._absolute = false;
        this._scopeStack = [];
        this._absolute = absolute;
    }
    get scope() {
        return this._scopeStack[this._scopeStack.length - 1];
    }
    preorder(node, spine) {
        if (node.location && node.location.range.start.line > this.pos.line) {
            this.haltTraverse = true;
            return false;
        }
        if (!node.location || util.isInRange(this.pos, node.location.range) !== 0) {
            return false;
        }
        if ((node.kind & this._kindMask) > 0 &&
            !(node.modifiers & 4096) &&
            (!this._absolute || node.kind !== 64 || !(node.modifiers & 512))) {
            this._scopeStack.push(node);
        }
        return true;
    }
}
class ContainsVisitor {
    constructor(symbol) {
        this.haltTraverse = false;
        this.found = false;
        this._symbol = symbol;
        if (!symbol.location) {
            throw new Error('Invalid Argument');
        }
    }
    preorder(node, spine) {
        if (node === this._symbol) {
            this.found = true;
            this.haltTraverse = true;
            return false;
        }
        if (node.location && util.isInRange(this._symbol.location.range.start, node.location.range) !== 0) {
            return false;
        }
        return true;
    }
}
class SymbolTableIndex {
    constructor() {
        this._count = 0;
        this._tables = [];
        this._search = new types_1.BinarySearch(this._tables);
    }
    count() {
        return this._count;
    }
    *tables() {
        let node;
        for (let n = 0, nl = this._tables.length; n < nl; ++n) {
            node = this._tables[n];
            for (let k = 0, tl = node.tables.length; k < tl; ++k) {
                yield node.tables[k];
            }
        }
    }
    add(table) {
        let fn = this._createCompareFn(table.uri);
        let search = this._search.search(fn);
        if (search.isExactMatch) {
            let node = this._tables[search.rank];
            if (node.tables.find(this._createUriFindFn(table.uri))) {
                --this._count;
                throw new Error(`Duplicate key ${table.uri}`);
            }
            node.tables.push(table);
        }
        else {
            let node = { hash: table.hash, tables: [table] };
            this._tables.splice(search.rank, 0, node);
        }
        ++this._count;
    }
    remove(uri) {
        let fn = this._createCompareFn(uri);
        let node = this._search.find(fn);
        if (node) {
            let i = node.tables.findIndex(this._createUriFindFn(uri));
            if (i > -1) {
                --this._count;
                return node.tables.splice(i, 1).pop();
            }
        }
    }
    find(uri) {
        let fn = this._createCompareFn(uri);
        let node = this._search.find(fn);
        return node ? node.tables.find(this._createUriFindFn(uri)) : null;
    }
    findBySymbol(s) {
        if (!s.location) {
            return undefined;
        }
        let node = this._search.find((x) => {
            return x.hash - s.location.uriHash;
        });
        if (!node || !node.tables.length) {
            return undefined;
        }
        else if (node.tables.length === 1) {
            return node.tables[0];
        }
        else {
            let table;
            for (let n = 0; n < node.tables.length; ++n) {
                table = node.tables[n];
                if (table.contains(s)) {
                    return table;
                }
            }
        }
        return undefined;
    }
    toJSON() {
        return {
            _tables: this._tables,
            _count: this._count
        };
    }
    fromJSON(data) {
        this._count = data._count;
        this._tables = [];
        let node;
        let newNode;
        for (let n = 0; n < data._tables.length; ++n) {
            node = data._tables[n];
            newNode = {
                hash: node.hash,
                tables: []
            };
            for (let k = 0; k < node.tables.length; ++k) {
                newNode.tables.push(SymbolTable.fromJSON(node.tables[k]));
            }
            this._tables.push(newNode);
        }
        this._search = new types_1.BinarySearch(this._tables);
    }
    _createCompareFn(uri) {
        let hash = Math.abs(util.hash32(uri));
        return (x) => {
            return x.hash - hash;
        };
    }
    _createUriFindFn(uri) {
        return (x) => {
            return x.uri === uri;
        };
    }
}
exports.SymbolTableIndex = SymbolTableIndex;
