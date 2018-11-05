'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const typeAggregate_1 = require("./typeAggregate");
const util = require("./util");
class ReferenceProvider {
    constructor(documentStore, symbolStore, refStore) {
        this.documentStore = documentStore;
        this.symbolStore = symbolStore;
        this.refStore = refStore;
        this._provideReferences = (symbol, table) => {
            switch (symbol.kind) {
                case 128:
                case 256:
                    return Promise.resolve(this._variableReferences(symbol, table, this.symbolStore.getSymbolTable(table.uri)));
                case 1:
                case 2:
                case 4:
                case 64:
                case 8:
                    return this.refStore.find(symbol.name);
                case 16:
                    return this._propertyReferences(symbol, table);
                case 1024:
                    return this._classConstantReferences(symbol, table);
                case 32:
                    return this._methodReferences(symbol, table);
                default:
                    return Promise.resolve([]);
            }
        };
    }
    provideReferenceLocations(uri, position, referenceContext) {
        let locations = [];
        let doc = this.documentStore.find(uri);
        let table = this.refStore.getReferenceTable(uri);
        if (!doc || !table) {
            return Promise.resolve(locations);
        }
        let symbols;
        let ref = table.referenceAtPosition(position);
        if (ref) {
            if (ref.kind === 2048) {
                ref = { kind: 1, name: ref.name, location: ref.location };
            }
            symbols = this.symbolStore.findSymbolsByReference(ref, 3);
        }
        else {
            return Promise.resolve(locations);
        }
        return this.provideReferences(symbols, table, referenceContext.includeDeclaration).then((refs) => {
            return refs.map((v) => {
                return v.location;
            });
        });
    }
    provideReferences(symbols, table, includeDeclaration) {
        let refs = [];
        symbols = symbols.slice();
        let provideRefsFn = this._provideReferences;
        return new Promise((resolve, reject) => {
            let onResolve = (r) => {
                Array.prototype.push.apply(refs, r);
                let s = symbols.pop();
                if (s) {
                    provideRefsFn(s, table).then(onResolve);
                }
                else {
                    resolve(Array.from(new Set(refs)));
                }
            };
            onResolve([]);
        });
    }
    _methodReferences(symbol, table) {
        if ((symbol.modifiers & 4) > 0) {
            let lcScope = symbol.scope ? symbol.scope.toLowerCase() : '';
            let name = symbol.name.toLowerCase();
            let fn = (x) => {
                return x.kind === 32 && x.name.toLowerCase() === name && x.scope && x.scope.toLowerCase() === lcScope;
            };
            return Promise.resolve(this._symbolRefsInTableScope(symbol, table, fn));
        }
        else {
            return this.refStore.find(symbol.name, this._createMemberReferenceFilterFn(symbol));
        }
    }
    _classConstantReferences(symbol, table) {
        if ((symbol.modifiers & 4) > 0) {
            let lcScope = symbol.scope ? symbol.scope.toLowerCase() : '';
            let fn = (x) => {
                return x.kind === 1024 && x.name === symbol.name && x.scope && x.scope.toLowerCase() === lcScope;
            };
            return Promise.resolve(this._symbolRefsInTableScope(symbol, table, fn));
        }
        else {
            return this.refStore.find(symbol.name, this._createMemberReferenceFilterFn(symbol));
        }
    }
    _propertyReferences(symbol, table) {
        let name = symbol.name;
        if ((symbol.modifiers & 4) > 0) {
            let lcScope = symbol.scope ? symbol.scope.toLowerCase() : '';
            let fn = (x) => {
                return x.kind === 16 && x.name === name && x.scope && lcScope === x.scope.toLowerCase();
            };
            return Promise.resolve(this._symbolRefsInTableScope(symbol, table, fn));
        }
        else {
            return this.refStore.find(name, this._createMemberReferenceFilterFn(symbol));
        }
    }
    _createMemberReferenceFilterFn(baseMember) {
        let store = this.symbolStore;
        let lcBaseTypeName = baseMember.scope ? baseMember.scope.toLowerCase() : '';
        let map = {};
        map[lcBaseTypeName] = true;
        let associatedFilterFn = (x) => {
            return lcBaseTypeName === x.name.toLowerCase();
        };
        return (r) => {
            if (!(r.kind & (16 | 32 | 1024)) || !r.scope) {
                return false;
            }
            let lcScope = r.scope.toLowerCase();
            if (map[lcScope] !== undefined) {
                return map[lcScope];
            }
            let aggregateType = typeAggregate_1.TypeAggregate.create(store, r.scope);
            if (!aggregateType) {
                return map[lcScope] = false;
            }
            return map[lcScope] = aggregateType.associated(associatedFilterFn).length > 0;
        };
    }
    _variableReferences(symbol, refTable, symbolTable) {
        let symbolTreeTraverser = symbolTable.createTraverser();
        symbolTreeTraverser.find((x) => {
            return x === symbol;
        });
        let outerScope = symbolTreeTraverser.parent();
        let useVarFn = (s) => {
            return s.kind === 256 &&
                (s.modifiers & 4096) > 0 &&
                s.name === symbol.name;
        };
        let isScopeSymbol = (x) => {
            return x.kind === 64 && (x.modifiers & 512) > 0 && util.find(x.children, useVarFn) !== undefined;
        };
        while (outerScope && isScopeSymbol(outerScope)) {
            outerScope = symbolTreeTraverser.parent();
        }
        if (!outerScope) {
            return [];
        }
        let scopePositions = [];
        let varScopeVisitor = {
            preorder: (node, spine) => {
                if (node === outerScope || isScopeSymbol(node)) {
                    if (node.location) {
                        scopePositions.push(node.location.range.start);
                    }
                    return true;
                }
                return false;
            }
        };
        symbolTreeTraverser.traverse(varScopeVisitor);
        if (!scopePositions.length) {
            return [];
        }
        let refTreeTraverser = refTable.createTraverser();
        let refs = [];
        let refFn = (r) => {
            return (r.kind === 256 || r.kind === 128) && r.name === symbol.name;
        };
        let isScope = (x) => {
            return x.kind === undefined && x.location && scopePositions.length && util.positionEquality(x.location.range.start, scopePositions[0]);
        };
        if (!refTreeTraverser.find(isScope)) {
            return [];
        }
        let refVisitor = {
            preorder: (node, spine) => {
                if (isScope(node)) {
                    scopePositions.shift();
                    return true;
                }
                else if (refFn(node)) {
                    refs.push(node);
                }
                return false;
            }
        };
        refTreeTraverser.traverse(refVisitor);
        return refs;
    }
    _symbolRefsInTableScope(symbol, refTable, filterFn) {
        let traverser = refTable.createTraverser();
        let pos = symbol.location ? symbol.location.range.start : undefined;
        if (!pos) {
            return [];
        }
        let findFn = (x) => {
            return x.kind === undefined &&
                x.location && x.location.range && util.positionEquality(x.location.range.start, pos);
        };
        if (traverser.find(findFn) && traverser.parent()) {
            return traverser.filter(filterFn);
        }
        return [];
    }
}
exports.ReferenceProvider = ReferenceProvider;
