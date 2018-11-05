/* Copyright (c) Ben Robert Mewburn
 * Licensed under the ISC Licence.
 */

'use strict';

import {Location, SymbolInformation, SymbolKind as Kind} from 'vscode-languageserver-types';
import { PhpSymbol, SymbolKind, SymbolModifier } from './symbol';
import {SymbolStore} from './symbolStore';

const namespacedSymbolMask =
    SymbolKind.Interface |
    SymbolKind.Class |
    SymbolKind.Trait |
    SymbolKind.Constant |
    SymbolKind.Function;

export class SymbolProvider {

    constructor(public symbolStore: SymbolStore) { }

    /**
     * Excludes magic symbols
     * @param uri 
     */
    provideDocumentSymbols(uri: string) {
        let symbolTable = this.symbolStore.getSymbolTable(uri);
        let symbols = symbolTable ? symbolTable.symbols : [];
        let symbolInformationList: SymbolInformation[] = [];
        let s: PhpSymbol;

        for (let n = 0, l = symbols.length; n < l; ++n) {
            s = symbols[n];
            if (s.location) {
                symbolInformationList.push(this.toSymbolInformation(s));
            }
        }

        return symbolInformationList;
    }

    /**
     * Excludes internal symbols
     * @param query 
     */
    provideWorkspaceSymbols(query: string) {
        let maxItems = 100;
        const matches = this.symbolStore.matchIterator(query, this.workspaceSymbolFilter);
        const symbolInformationList: SymbolInformation[] = [];

        for(let s of matches) {
            symbolInformationList.push(this.toSymbolInformation(s));
            if(--maxItems < 1) {
                break;
            }
        }

        return symbolInformationList;
    }

    workspaceSymbolFilter(s: PhpSymbol) {

        return !(s.modifiers & (SymbolModifier.Anonymous | SymbolModifier.Use | SymbolModifier.Private)) &&
            s.location &&   //no inbuilt or unlocatable
            s.kind !== SymbolKind.Parameter &&  //no params
            (s.kind !== SymbolKind.Variable || !s.scope); //global vars 

    }

    toSymbolInformation(s: PhpSymbol, uri?:string) {

        let si: SymbolInformation = {
            kind: Kind.File,
            name: s.name,
            location: uri ? Location.create(uri, s.location.range) : this.symbolStore.symbolLocation(s),
            containerName: s.scope
        };

        if ((s.kind & namespacedSymbolMask) > 0) {
            let nsSeparatorPos = s.name.lastIndexOf('\\');
            if (nsSeparatorPos >= 0) {
                si.name = s.name.slice(nsSeparatorPos + 1);
                si.containerName = s.name.slice(0, nsSeparatorPos);
            }
        }

        switch (s.kind) {
            case SymbolKind.Class:
                si.kind = Kind.Class;
                break;
            case SymbolKind.Constant:
            case SymbolKind.ClassConstant:
                si.kind = Kind.Constant;
                break;
            case SymbolKind.Function:
                si.kind = Kind.Function;
                break;
            case SymbolKind.Interface:
                si.kind = Kind.Interface;
                break;
            case SymbolKind.Method:
                if (s.name === '__construct') {
                    si.kind = Kind.Constructor;
                } else {
                    si.kind = Kind.Method;
                }
                break;
            case SymbolKind.Namespace:
                si.kind = Kind.Namespace;
                break;
            case SymbolKind.Property:
                si.kind = Kind.Property;
                break;
            case SymbolKind.Trait:
                si.kind = Kind.Module;
                break;
            case SymbolKind.Variable:
            case SymbolKind.Parameter:
                si.kind = Kind.Variable;
                break;
            default:
                throw new Error(`Invalid argument ${s.kind}`);

        }

        return si;
    }
}

