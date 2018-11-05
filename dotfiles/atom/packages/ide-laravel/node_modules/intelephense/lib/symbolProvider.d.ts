import { SymbolInformation } from 'vscode-languageserver-types';
import { PhpSymbol } from './symbol';
import { SymbolStore } from './symbolStore';
export declare class SymbolProvider {
    symbolStore: SymbolStore;
    constructor(symbolStore: SymbolStore);
    provideDocumentSymbols(uri: string): SymbolInformation[];
    provideWorkspaceSymbols(query: string): SymbolInformation[];
    workspaceSymbolFilter(s: PhpSymbol): boolean;
    toSymbolInformation(s: PhpSymbol, uri?: string): SymbolInformation;
}
