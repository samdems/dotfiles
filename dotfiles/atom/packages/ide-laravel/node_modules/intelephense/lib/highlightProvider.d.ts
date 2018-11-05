import { ParsedDocumentStore } from './parsedDocument';
import { SymbolStore } from './symbolStore';
import { ReferenceStore } from './reference';
import { Position, DocumentHighlight } from 'vscode-languageserver-types';
export declare class HighlightProvider {
    docStore: ParsedDocumentStore;
    symbolStore: SymbolStore;
    refStore: ReferenceStore;
    constructor(docStore: ParsedDocumentStore, symbolStore: SymbolStore, refStore: ReferenceStore);
    provideHightlights(uri: string, pos: Position): DocumentHighlight[];
}
