'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./types");
const util = require("./util");
const logger_1 = require("./logger");
var Reference;
(function (Reference) {
    function create(kind, name, location) {
        return {
            kind: kind,
            name: name,
            location: location
        };
    }
    Reference.create = create;
})(Reference = exports.Reference || (exports.Reference = {}));
var Scope;
(function (Scope) {
    function create(location) {
        return {
            location: location,
            children: []
        };
    }
    Scope.create = create;
})(Scope = exports.Scope || (exports.Scope = {}));
class ReferenceTable {
    constructor(uri, root, hash) {
        this._uri = uri;
        this._root = root;
        if (hash) {
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
    get referenceCount() {
        return this.references().length;
    }
    references(filter) {
        let traverser = new types_1.TreeTraverser([this.root]);
        let visitor = new ReferencesVisitor(filter);
        traverser.traverse(visitor);
        return visitor.references;
    }
    referenceAtPosition(position) {
        let visitor = new LocateVisitor(position);
        this.traverse(visitor);
        let ref = visitor.node;
        return ref && ref.kind ? ref : undefined;
    }
    scopeAtPosition(position) {
        let visitor = new LocateVisitor(position);
        this.traverse(visitor);
        let node = visitor.node;
        return node && node.kind === undefined ? node : undefined;
    }
    createTraverser() {
        return new types_1.TreeTraverser([this.root]);
    }
    traverse(visitor) {
        let traverser = new types_1.TreeTraverser([this.root]);
        traverser.traverse(visitor);
        return visitor;
    }
    static fromJSON(data) {
        return new ReferenceTable(data._uri, data._root, data._hash);
    }
}
exports.ReferenceTable = ReferenceTable;
var ReferenceTableSummary;
(function (ReferenceTableSummary) {
    function fromTable(table) {
        return table.traverse(new ReferenceTableSummaryVisitor(table.uri)).referenceTableSummary;
    }
    ReferenceTableSummary.fromTable = fromTable;
    function create(uri, identifiers) {
        return {
            uri: uri,
            identifiers: identifiers
        };
    }
    ReferenceTableSummary.create = create;
    var collator = new Intl.Collator('en');
    function compare(a, b) {
        return collator.compare(a.uri, b.uri);
    }
    ReferenceTableSummary.compare = compare;
    function keys(x) {
        return x.identifiers;
    }
    ReferenceTableSummary.keys = keys;
    function uriCompareFn(uri) {
        return (x) => {
            return collator.compare(x.uri, uri);
        };
    }
    ReferenceTableSummary.uriCompareFn = uriCompareFn;
})(ReferenceTableSummary || (ReferenceTableSummary = {}));
class ReferenceStore {
    constructor(cache) {
        this._fetchTable = (uri) => {
            let findOpenTableFn = (t) => { return t.uri === uri; };
            let table = this.getReferenceTable(uri);
            if (table) {
                return Promise.resolve(table);
            }
            else {
                return this._cache.read(uri).then((obj) => {
                    return Promise.resolve(new ReferenceTable(uri, obj));
                });
            }
        };
        this._nameIndex = new types_1.NameIndex(ReferenceTableSummary.keys);
        this._summaryIndex = new types_1.SortedList(ReferenceTableSummary.compare);
        this._tables = [];
        this._cache = cache;
    }
    *knownDocuments() {
        let items = this._summaryIndex.items;
        for (let n = 0, l = items.length; n < l; ++n) {
            yield items[n].uri;
        }
    }
    getReferenceTable(uri) {
        return util.find(this._tables, (t) => { return t.uri === uri; });
    }
    add(table) {
        if (this.getReferenceTable(table.uri) || this._summaryIndex.find(ReferenceTableSummary.uriCompareFn(table.uri))) {
            this.remove(table.uri);
        }
        this._tables.push(table);
        let summary = ReferenceTableSummary.fromTable(table);
        this._summaryIndex.add(summary);
        this._nameIndex.add(summary);
    }
    remove(uri, purge) {
        this._tablesRemove(uri);
        let summary = this._summaryRemove(uri);
        if (!summary) {
            return;
        }
        this._nameIndex.remove(summary);
        if (purge) {
            this._cache.delete(uri);
        }
    }
    close(uri) {
        let table = this._tablesRemove(uri);
        if (table) {
            return this._cache.write(table.uri, table.root).catch((msg) => { logger_1.Log.error(msg); });
        }
        return Promise.resolve();
    }
    closeAll() {
        let tables = this._tables;
        let cache = this._cache;
        this._tables = [];
        let count = tables.length;
        return new Promise((resolve, reject) => {
            let onReject = (msg) => {
                --count;
                logger_1.Log.error(msg);
                writeTableFn();
            };
            let onResolve = () => {
                --count;
                writeTableFn();
            };
            let writeTableFn = () => {
                let table = tables.pop();
                if (table) {
                    cache.write(table.uri, table).then(onResolve).catch(onReject);
                }
                else if (count < 1) {
                    resolve();
                }
            };
            let maxOpenFiles = Math.min(4, tables.length);
            for (let n = 0; n < maxOpenFiles; ++n) {
                writeTableFn();
            }
        });
    }
    find(name, filter) {
        if (!name) {
            return Promise.resolve([]);
        }
        let summaries = this._nameIndex.find(name);
        let count = summaries.length;
        if (!count) {
            return Promise.resolve([]);
        }
        let tables = [];
        let fetchTableFn = this._fetchTable;
        let findInTablesFn = this._findInTables;
        return new Promise((resolve, reject) => {
            let onSuccess = (table) => {
                tables.push(table);
                onAlways();
            };
            let onFail = (msg) => {
                logger_1.Log.warn(msg);
                onAlways();
            };
            let onAlways = () => {
                count--;
                if (count < 1) {
                    resolve(findInTablesFn(tables, name, filter));
                }
                else {
                    let summary = summaries.pop();
                    if (summary) {
                        fetchTableFn(summary.uri).then(onSuccess).catch(onFail);
                    }
                }
            };
            let maxOpenFiles = Math.min(4, summaries.length);
            while (maxOpenFiles--) {
                fetchTableFn(summaries.pop().uri).then(onSuccess).catch(onFail);
            }
        });
    }
    fromJSON(data) {
        this._summaryIndex = new types_1.SortedList(ReferenceTableSummary.compare, data);
        let items = this._summaryIndex.items;
        let item;
        for (let n = 0; n < items.length; ++n) {
            item = items[n];
            this._nameIndex.add(item);
        }
    }
    toJSON() {
        return this._summaryIndex.items;
    }
    _findInTables(tables, name, filter) {
        const caseSensitiveKindMask = 16 | 256 | 8 | 1024;
        let refs = [];
        let lcName = name.toLowerCase();
        let table;
        if (!name || !tables.length) {
            return refs;
        }
        let predicate = (r) => {
            return (((r.kind & caseSensitiveKindMask) > 0 && name === r.name) ||
                (!(r.kind & caseSensitiveKindMask) && lcName === r.name.toLowerCase())) &&
                (!filter || filter(r));
        };
        for (let n = 0; n < tables.length; ++n) {
            table = tables[n];
            Array.prototype.push.apply(refs, table.references(predicate));
        }
        return refs;
    }
    _tablesRemove(uri) {
        let index = this._tables.findIndex((t) => { return t.uri === uri; });
        if (index > -1) {
            return this._tables.splice(index, 1).shift();
        }
        return undefined;
    }
    _summaryRemove(uri) {
        let cmpFn = ReferenceTableSummary.uriCompareFn(uri);
        return this._summaryIndex.remove(cmpFn);
    }
}
exports.ReferenceStore = ReferenceStore;
class ReferencesVisitor {
    constructor(filter) {
        this._filter = filter;
        this._refs = [];
    }
    get references() {
        return this._refs;
    }
    preorder(node, spine) {
        if (node.kind !== undefined && (!this._filter || this._filter(node))) {
            this._refs.push(node);
        }
        return true;
    }
}
class ReferenceTableSummaryVisitor {
    constructor(uri) {
        this.uri = uri;
        this.identifiers = new Set();
    }
    get referenceTableSummary() {
        return ReferenceTableSummary.create(this.uri, Array.from(this.identifiers));
    }
    preorder(node, spine) {
        if (this._shouldIndex(node)) {
            let lcName = node.name.toLowerCase();
            let altName = node.altName;
            if (lcName) {
                this.identifiers.add(lcName);
            }
            if (altName) {
                let lcAltName = altName.toLowerCase();
                if (lcAltName !== lcName && lcAltName !== 'static' && lcAltName !== 'self' && lcAltName !== 'parent') {
                    this.identifiers.add(lcAltName);
                }
            }
        }
        return true;
    }
    _shouldIndex(node) {
        switch (node.kind) {
            case undefined:
            case 256:
            case 128:
                return false;
            default:
                return true;
        }
    }
}
class LocateVisitor {
    constructor(position) {
        this.position = position;
    }
    get node() {
        return this._node;
    }
    preorder(node, spine) {
        if (node.location && node.location.range && util.isInRange(this.position, node.location.range) === 0) {
            this._node = node;
            return true;
        }
        return false;
    }
}
