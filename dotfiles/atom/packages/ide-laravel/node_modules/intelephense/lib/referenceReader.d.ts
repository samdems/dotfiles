import { TreeVisitor } from './types';
import { Phrase, Token } from 'php7parser';
import { SymbolStore } from './symbolStore';
import { ParsedDocument } from './parsedDocument';
import { NameResolver } from './nameResolver';
import { ReferenceTable } from './reference';
export declare class ReferenceReader implements TreeVisitor<Phrase | Token> {
    doc: ParsedDocument;
    nameResolver: NameResolver;
    symbolStore: SymbolStore;
    private _transformStack;
    private _variableTable;
    private _classStack;
    private _scopeStack;
    private _symbols;
    private _symbolFilter;
    private _lastVarTypehints;
    private _symbolTable;
    constructor(doc: ParsedDocument, nameResolver: NameResolver, symbolStore: SymbolStore);
    readonly refTable: ReferenceTable;
    preorder(node: Phrase | Token, spine: (Phrase | Token)[]): boolean;
    postorder(node: Phrase | Token, spine: (Phrase | Token)[]): void;
    private _currentClassName();
    private _scopeStackPush(scope);
    private _nameSymbolType(parent);
    private _methodDeclaration(node);
    private _functionDeclaration(node);
    private _anonymousFunctionCreationExpression(node);
    private _referenceSymbols;
}
export declare namespace ReferenceReader {
    function discoverReferences(doc: ParsedDocument, symbolStore: SymbolStore): ReferenceTable;
}
