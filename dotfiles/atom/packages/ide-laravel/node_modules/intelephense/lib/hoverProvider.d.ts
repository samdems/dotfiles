import { ParsedDocumentStore } from './parsedDocument';
import { SymbolStore } from './symbolStore';
import { ReferenceStore } from './reference';
import { Position, Hover } from 'vscode-languageserver-types';
export declare class HoverProvider {
    docStore: ParsedDocumentStore;
    symbolStore: SymbolStore;
    refStore: ReferenceStore;
    constructor(docStore: ParsedDocumentStore, symbolStore: SymbolStore, refStore: ReferenceStore);
    provideHover(uri: string, pos: Position): Hover;
    private modifiersToString(modifiers);
}
