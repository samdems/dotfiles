import { Position, TextEdit } from 'vscode-languageserver-types';
import { ParsedDocumentStore } from './parsedDocument';
import { SymbolStore } from './symbolStore';
import { ReferenceStore } from './reference';
export declare class NameTextEditProvider {
    symbolStore: SymbolStore;
    docStore: ParsedDocumentStore;
    refStore: ReferenceStore;
    constructor(symbolStore: SymbolStore, docStore: ParsedDocumentStore, refStore: ReferenceStore);
    provideContractFqnTextEdits(uri: string, position: Position, alias?: string): TextEdit[];
    private _fullyQualifiedNamePhrase(position, doc, table, refTable);
    private _isFullyQualifiedName(node);
}
