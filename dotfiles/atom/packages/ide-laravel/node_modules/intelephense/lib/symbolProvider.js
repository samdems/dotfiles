'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
const namespacedSymbolMask = 2 |
    1 |
    4 |
    8 |
    64;
class SymbolProvider {
    constructor(symbolStore) {
        this.symbolStore = symbolStore;
    }
    provideDocumentSymbols(uri) {
        let symbolTable = this.symbolStore.getSymbolTable(uri);
        let symbols = symbolTable ? symbolTable.symbols : [];
        let symbolInformationList = [];
        let s;
        for (let n = 0, l = symbols.length; n < l; ++n) {
            s = symbols[n];
            if (s.location) {
                symbolInformationList.push(this.toSymbolInformation(s));
            }
        }
        return symbolInformationList;
    }
    provideWorkspaceSymbols(query) {
        let maxItems = 100;
        const matches = this.symbolStore.matchIterator(query, this.workspaceSymbolFilter);
        const symbolInformationList = [];
        for (let s of matches) {
            symbolInformationList.push(this.toSymbolInformation(s));
            if (--maxItems < 1) {
                break;
            }
        }
        return symbolInformationList;
    }
    workspaceSymbolFilter(s) {
        return !(s.modifiers & (512 | 4096 | 4)) &&
            s.location &&
            s.kind !== 128 &&
            (s.kind !== 256 || !s.scope);
    }
    toSymbolInformation(s, uri) {
        let si = {
            kind: vscode_languageserver_types_1.SymbolKind.File,
            name: s.name,
            location: uri ? vscode_languageserver_types_1.Location.create(uri, s.location.range) : this.symbolStore.symbolLocation(s),
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
            case 1:
                si.kind = vscode_languageserver_types_1.SymbolKind.Class;
                break;
            case 8:
            case 1024:
                si.kind = vscode_languageserver_types_1.SymbolKind.Constant;
                break;
            case 64:
                si.kind = vscode_languageserver_types_1.SymbolKind.Function;
                break;
            case 2:
                si.kind = vscode_languageserver_types_1.SymbolKind.Interface;
                break;
            case 32:
                if (s.name === '__construct') {
                    si.kind = vscode_languageserver_types_1.SymbolKind.Constructor;
                }
                else {
                    si.kind = vscode_languageserver_types_1.SymbolKind.Method;
                }
                break;
            case 512:
                si.kind = vscode_languageserver_types_1.SymbolKind.Namespace;
                break;
            case 16:
                si.kind = vscode_languageserver_types_1.SymbolKind.Property;
                break;
            case 4:
                si.kind = vscode_languageserver_types_1.SymbolKind.Module;
                break;
            case 256:
            case 128:
                si.kind = vscode_languageserver_types_1.SymbolKind.Variable;
                break;
            default:
                throw new Error(`Invalid argument ${s.kind}`);
        }
        return si;
    }
}
exports.SymbolProvider = SymbolProvider;
