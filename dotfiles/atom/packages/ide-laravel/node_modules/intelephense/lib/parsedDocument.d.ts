import { Phrase, Token, TokenType, PhraseType } from 'php7parser';
import * as lsp from 'vscode-languageserver-types';
import { TreeVisitor, Event, Predicate, Traversable, HashedLocation } from './types';
export interface NodeTransform {
    phraseType?: PhraseType;
    tokenType?: TokenType;
    push(transform: NodeTransform): any;
}
export interface ParsedDocumentChangeEventArgs {
    parsedDocument: ParsedDocument;
}
export declare class ParsedDocument implements Traversable<Phrase | Token> {
    version: number;
    private static _wordRegex;
    private _textDocument;
    private _uriHash;
    private _parseTree;
    private _changeEvent;
    private _debounce;
    private _reparse;
    constructor(uri: string, text: string, version?: number);
    readonly tree: Phrase;
    readonly uri: string;
    readonly text: string;
    readonly changeEvent: Event<ParsedDocumentChangeEventArgs>;
    find(predicate: Predicate<Phrase | Token>): Phrase;
    textBeforeOffset(offset: number, length: number): string;
    lineSubstring(offset: number): string;
    wordAtOffset(offset: number): string;
    flush(): void;
    traverse(visitor: TreeVisitor<Phrase | Token>): TreeVisitor<Token | Phrase>;
    applyChanges(contentChanges: lsp.TextDocumentContentChangeEvent[]): void;
    tokenRange(t: Token): lsp.Range;
    nodeHashedLocation(node: Phrase | Token): HashedLocation;
    nodeLocation(node: Phrase | Token): lsp.Location;
    nodeRange(node: Phrase | Token): lsp.Range;
    tokenText(t: Token): string;
    nodeText(node: Phrase | Token): string;
    createAnonymousName(node: Phrase): string;
    positionAtOffset(offset: number): lsp.Position;
    offsetAtPosition(position: lsp.Position): number;
    documentLanguageRanges(): LanguageRange[];
}
export declare namespace ParsedDocument {
    function firstToken(node: Phrase | Token): Token;
    function lastToken(node: Phrase | Token): Token;
    function isToken(node: Phrase | Token, types?: TokenType[]): boolean;
    function isPhrase(node: Phrase | Token, types?: PhraseType[]): boolean;
    function isOffsetInToken(offset: number, t: Token): boolean;
    function isOffsetInNode(offset: any, node: Phrase | Token): boolean;
    function findChild(parent: Phrase, fn: Predicate<Phrase | Token>): Token | Phrase;
    function filterChildren(parent: Phrase, fn: Predicate<Phrase | Token>): (Token | Phrase)[];
    function isNamePhrase(node: Phrase | Token): boolean;
}
export declare class ParsedDocumentStore {
    private _parsedDocumentChangeEvent;
    private _parsedDocumentmap;
    private _unsubscribeMap;
    private _bubbleEvent;
    constructor();
    readonly parsedDocumentChangeEvent: Event<ParsedDocumentChangeEventArgs>;
    readonly count: number;
    readonly documents: ParsedDocument[];
    has(uri: string): boolean;
    add(parsedDocument: ParsedDocument): void;
    remove(uri: string): void;
    find(uri: string): ParsedDocument;
}
export interface LanguageRange {
    range: lsp.Range;
    languageId?: string;
}
