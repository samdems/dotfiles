import { TreeVisitor, HashedLocation } from './types';
import { ParsedDocument } from './parsedDocument';
import { Phrase, Token } from 'php7parser';
import { PhpDoc } from './phpDoc';
import { PhpSymbol, SymbolModifier } from './symbol';
import { NameResolver } from './nameResolver';
export declare class SymbolReader implements TreeVisitor<Phrase | Token> {
    document: ParsedDocument;
    nameResolver: NameResolver;
    lastPhpDoc: PhpDoc;
    lastPhpDocLocation: HashedLocation;
    private _transformStack;
    private _uriHash;
    constructor(document: ParsedDocument, nameResolver: NameResolver);
    readonly symbol: PhpSymbol;
    preorder(node: Phrase | Token, spine: (Phrase | Token)[]): boolean;
    postorder(node: Phrase | Token, spine: (Phrase | Token)[]): void;
}
export declare namespace SymbolReader {
    function assignPhpDocInfoToSymbol(s: PhpSymbol, doc: PhpDoc, docLocation: HashedLocation, nameResolver: NameResolver): PhpSymbol;
    function phpDocMembers(phpDoc: PhpDoc, phpDocLoc: HashedLocation, nameResolver: NameResolver): PhpSymbol[];
    function modifierListToSymbolModifier(phrase: Phrase): 0 | SymbolModifier;
    function modifierTokenToSymbolModifier(t: Token): SymbolModifier;
}
