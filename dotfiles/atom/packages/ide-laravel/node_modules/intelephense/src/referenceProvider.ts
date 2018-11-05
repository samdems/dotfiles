/* Copyright (c) Ben Robert Mewburn
 * Licensed under the ISC Licence.
 */

'use strict';

import { Position, ReferenceContext, Location } from 'vscode-languageserver-types';
import { ParsedDocumentStore, ParsedDocument } from './parsedDocument';
import { ParseTreeTraverser } from './parseTreeTraverser';
import { SymbolStore, SymbolTable } from './symbolStore';
import { PhpSymbol, SymbolKind, SymbolModifier, SymbolIdentifier } from './symbol';
import { MemberMergeStrategy, TypeAggregate } from './typeAggregate';
import { Reference, ReferenceStore, ReferenceTable, Scope } from './reference';
import { Predicate, TreeVisitor, TreeTraverser } from './types';
import * as util from './util';

export class ReferenceProvider {

    constructor(public documentStore: ParsedDocumentStore, public symbolStore: SymbolStore, public refStore: ReferenceStore) {

    }

    provideReferenceLocations(uri: string, position: Position, referenceContext: ReferenceContext) {

        let locations: Location[] = [];
        let doc = this.documentStore.find(uri);
        let table = this.refStore.getReferenceTable(uri);

        if (!doc || !table) {
            return Promise.resolve(locations);
        }

        let symbols: PhpSymbol[];
        let ref = table.referenceAtPosition(position);
        if (ref) {
            //get symbol definition
            //for constructors get the class instead of __construct
            if (ref.kind === SymbolKind.Constructor) {
                ref = { kind: SymbolKind.Class, name: ref.name, location: ref.location };
            }

            //if class member then make sure base symbol is fetched
            symbols = this.symbolStore.findSymbolsByReference(ref, MemberMergeStrategy.Base);
        } else {
            return Promise.resolve(locations);
        }

        return this.provideReferences(symbols, table, referenceContext.includeDeclaration).then((refs) => {
            return refs.map((v) => {
                return v.location;
            })
        });

    }

    /**
     * 
     * @param symbols must be base symbols where kind is method, class const or prop
     * @param table 
     * @param includeDeclaration 
     */
    provideReferences(symbols: PhpSymbol[], table: ReferenceTable, includeDeclaration: boolean): Promise<Reference[]> {

        let refs: Reference[] = [];
        symbols = symbols.slice();
        let provideRefsFn = this._provideReferences;

        return new Promise<Reference[]>((resolve, reject) => {

            let onResolve = (r:Reference[]) => {
                Array.prototype.push.apply(refs, r);
                let s = symbols.pop();
                if(s) {
                    provideRefsFn(s, table).then(onResolve);
                } else {
                    resolve(Array.from(new Set<Reference>(refs)));
                }
            }

            onResolve([]);

        });

    }

    private _provideReferences = (symbol: PhpSymbol, table: ReferenceTable): Promise<Reference[]> => {

        switch (symbol.kind) {
            case SymbolKind.Parameter:
            case SymbolKind.Variable:
                return Promise.resolve(this._variableReferences(symbol, table, this.symbolStore.getSymbolTable(table.uri)));
            case SymbolKind.Class:
            case SymbolKind.Interface:
            case SymbolKind.Trait:
            case SymbolKind.Function:
            case SymbolKind.Constant:
                return this.refStore.find(symbol.name);
            case SymbolKind.Property:
                return this._propertyReferences(symbol, table);
            case SymbolKind.ClassConstant:
                return this._classConstantReferences(symbol, table);
            case SymbolKind.Method:
                return this._methodReferences(symbol, table);
            default:
                return Promise.resolve<Reference[]>([]);
        }

    }

    private _methodReferences(symbol: PhpSymbol, table: ReferenceTable) {

        if ((symbol.modifiers & SymbolModifier.Private) > 0) {
            let lcScope = symbol.scope ? symbol.scope.toLowerCase() : '';
            let name = symbol.name.toLowerCase();
            let fn = (x: Reference) => {
                return x.kind === SymbolKind.Method && x.name.toLowerCase() === name && x.scope && x.scope.toLowerCase() === lcScope;
            };
            return Promise.resolve(this._symbolRefsInTableScope(symbol, table, fn));
        } else {
            return this.refStore.find(symbol.name, this._createMemberReferenceFilterFn(symbol));
        }
    }

    private _classConstantReferences(symbol: PhpSymbol, table: ReferenceTable) {

        if ((symbol.modifiers & SymbolModifier.Private) > 0) {
            let lcScope = symbol.scope ? symbol.scope.toLowerCase() : '';
            let fn = (x: Reference) => {
                return x.kind === SymbolKind.ClassConstant && x.name === symbol.name && x.scope && x.scope.toLowerCase() === lcScope;
            };
            return Promise.resolve(this._symbolRefsInTableScope(symbol, table, fn));
        } else {
            return this.refStore.find(symbol.name, this._createMemberReferenceFilterFn(symbol));
        }
    }

    private _propertyReferences(symbol: PhpSymbol, table: ReferenceTable) {

        let name = symbol.name;
        if ((symbol.modifiers & SymbolModifier.Private) > 0) {
            let lcScope = symbol.scope ? symbol.scope.toLowerCase() : '';
            let fn = (x: Reference) => {
                return x.kind === SymbolKind.Property && x.name === name && x.scope && lcScope === x.scope.toLowerCase();
            };
            return Promise.resolve(this._symbolRefsInTableScope(symbol, table, fn));
        } else {
            return this.refStore.find(name, this._createMemberReferenceFilterFn(symbol));
        }

    }

    private _createMemberReferenceFilterFn(baseMember: PhpSymbol) {

        let store = this.symbolStore;
        let lcBaseTypeName = baseMember.scope ? baseMember.scope.toLowerCase() : '';
        let map: { [index: string]: boolean } = {};
        map[lcBaseTypeName] = true;
        let associatedFilterFn = (x: PhpSymbol) => {
            return lcBaseTypeName === x.name.toLowerCase();
        };

        return (r: Reference) => {

            if (!(r.kind & (SymbolKind.Property | SymbolKind.Method | SymbolKind.ClassConstant)) || !r.scope) {
                return false;
            }

            let lcScope = r.scope.toLowerCase();
            if (map[lcScope] !== undefined) {
                return map[lcScope];
            }

            let aggregateType = TypeAggregate.create(store, r.scope);
            if (!aggregateType) {
                return map[lcScope] = false;
            }
            return map[lcScope] = aggregateType.associated(associatedFilterFn).length > 0;

        };

    }

    private _variableReferences(symbol: PhpSymbol, refTable: ReferenceTable, symbolTable:SymbolTable) {

        let symbolTreeTraverser = symbolTable.createTraverser();
        symbolTreeTraverser.find((x)=>{
            return x === symbol;
        });

        let outerScope = symbolTreeTraverser.parent();
        let useVarFn = (s: PhpSymbol) => {
            return s.kind === SymbolKind.Variable &&
                (s.modifiers & SymbolModifier.Use) > 0 &&
                s.name === symbol.name;
        };

        let isScopeSymbol:Predicate<PhpSymbol> = (x) => {
            return x.kind === SymbolKind.Function && (x.modifiers & SymbolModifier.Anonymous) > 0 && util.find(x.children, useVarFn) !== undefined;
        }

        while(outerScope && isScopeSymbol(outerScope)) {
            outerScope = symbolTreeTraverser.parent();
        }

        if(!outerScope) {
            return [];
        }
        
        //collect all scope positions to look for refs
        let scopePositions:Position[] = [];
        let varScopeVisitor:TreeVisitor<PhpSymbol> = {
            preorder:(node:PhpSymbol, spine:PhpSymbol[]) => {
                if(node === outerScope || isScopeSymbol(node)) {
                    if(node.location) {
                        scopePositions.push(node.location.range.start);
                    }
                    return true;
                }
                return false;
            }
        }

        symbolTreeTraverser.traverse(varScopeVisitor);
        if(!scopePositions.length) {
            return [];
        }
        
        let refTreeTraverser = refTable.createTraverser();
        let refs:Reference[] = [];
        let refFn = (r: Reference) => {
            return (r.kind === SymbolKind.Variable || r.kind === SymbolKind.Parameter) && r.name === symbol.name;
        };
        let isScope:Predicate<Scope|Reference> = (x:Scope|Reference) => {
            return (<Reference>x).kind === undefined && x.location && scopePositions.length && util.positionEquality(x.location.range.start, scopePositions[0])
        }
        if(!refTreeTraverser.find(isScope)) {
            return [];
        }
        
        let refVisitor:TreeVisitor<Scope|Reference> = {

            preorder:(node:Scope|Reference, spine:(Scope|Reference)[]) => {

                if(isScope(node)) {
                    scopePositions.shift();
                    return true;
                } else if(refFn(<Reference>node)) {
                    refs.push(<Reference>node);
                }
                return false;
            }
        }

        refTreeTraverser.traverse(refVisitor);
        return refs;

    }

    private _symbolRefsInTableScope(symbol: PhpSymbol, refTable: ReferenceTable, filterFn: Predicate<Scope|Reference>): Reference[] {

        let traverser = refTable.createTraverser();
        let pos = symbol.location ? symbol.location.range.start : undefined;
        if (!pos) {
            return [];
        }

        let findFn = (x: Scope | Reference) => {
            return (<Reference>x).kind === undefined &&
                x.location && x.location.range && util.positionEquality(x.location.range.start, pos);
        }
        if (traverser.find(findFn) && traverser.parent()) {
            return traverser.filter(filterFn) as Reference[];
        }

        return [];
    }

}