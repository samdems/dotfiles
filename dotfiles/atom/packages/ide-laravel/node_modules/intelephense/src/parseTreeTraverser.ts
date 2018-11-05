/* Copyright (c) Ben Robert Mewburn
 * Licensed under the ISC Licence.
 */

'use strict';

import { PhpSymbol, SymbolKind, SymbolModifier } from './symbol';
import { Reference, ReferenceTable } from './reference';
import { SymbolStore, SymbolTable } from './symbolStore';
import { NameResolver } from './nameResolver';
import { TreeVisitor, TreeTraverser, Predicate, MultiVisitor } from './types';
import { TypeString } from './typeString';
import { ParsedDocument } from './parsedDocument';
import { Position, TextEdit, Range } from 'vscode-languageserver-types';
import { Phrase, Token, PhraseType, TokenType, } from 'php7parser';
import * as util from './util';

export class ParseTreeTraverser extends TreeTraverser<Phrase | Token> {

    private _doc: ParsedDocument;
    private _symbolTable: SymbolTable;
    private _refTable:ReferenceTable;

    constructor(document: ParsedDocument, symbolTable: SymbolTable, refTable:ReferenceTable) {
        super([document.tree]);
        this._doc = document;
        this._symbolTable = symbolTable;
        this._refTable = refTable;
    }

    get document() {
        return this._doc;
    }

    get symbolTable() {
        return this._symbolTable;
    }

    get refTable() {
        return this._refTable;
    }

    get text() {
        return this._doc.nodeText(this.node);
    }

    get range() {
        return this._doc.nodeRange(this.node);
    }

    get reference() {
        let range = this.range;
        return this._refTable.referenceAtPosition(range.start);
    }

    get scope() {
        let range = this.range;
        if (!range) {
            return null;
        }
        return this._symbolTable.scope(range.start);
    }

    get nameResolver() {
        let firstToken = ParsedDocument.firstToken(this.node);
        let pos = this.document.positionAtOffset(firstToken.offset);
        return this._symbolTable.nameResolver(pos);
    }

    /**
     * Traverses to the token to the left of position
     * @param pos 
     */
    position(pos: Position) {
        let offset = this._doc.offsetAtPosition(pos) - 1;
        let fn = (x: Phrase | Token) => {
            return (<Token>x).tokenType !== undefined &&
                offset < (<Token>x).offset + (<Token>x).length &&
                offset >= (<Token>x).offset;
        };

        return this.find(fn) as Token;
    }

    clone() {
        let spine = this.spine;
        let traverser = new ParseTreeTraverser(this._doc, this._symbolTable, this._refTable);
        traverser._spine = spine;
        return traverser;
    }

    prevToken(skipTrivia?:boolean) {

        const spine = this._spine.slice(0);
        let current:Phrase|Token;
        let parent:Phrase|Token;
        let prevSiblingIndex:number;

        while(spine.length > 1) {

            current = spine.pop();
            parent = spine[spine.length - 1] as Phrase;
            prevSiblingIndex = parent.children.indexOf(current) - 1;

            if(prevSiblingIndex > -1) {
                spine.push(parent.children[prevSiblingIndex]);
                if(this._lastToken(spine, skipTrivia)) {
                    //token found
                    this._spine = spine;
                    return this.node;
                }
            }

            //go up

        }

        return undefined;

    }

    private _lastToken(spine:(Phrase|Token)[], skipTrivia?:boolean) {

        let node = spine[spine.length - 1];
        if((<Token>node).tokenType !== undefined && (!skipTrivia || (<Token>node).tokenType < TokenType.Comment)) {
            return spine;
        }

        if(!(<Phrase>node).children) {
            return undefined;
        }

        for(let n = (<Phrase>node).children.length - 1; n >= 0; --n) {
            spine.push((<Phrase>node).children[n]);
            if(this._lastToken(spine)) {
                return spine;
            } else {
                spine.pop();
            }
        }

        return undefined;

    }

    /**
     * True if current node is the name part of a declaration
     */
    get isDeclarationName() {

        let traverser = this.clone();
        let t = traverser.node as Token;
        let parent = traverser.parent() as Phrase;

        if (!t || !parent) {
            return false;
        }

        return ((t.tokenType === TokenType.Name || t.tokenType === TokenType.VariableName) && this._isDeclarationPhrase(parent)) ||
            (parent.phraseType === PhraseType.Identifier && this._isDeclarationPhrase(<Phrase>traverser.parent()));

    }

    private _isDeclarationPhrase(node: Phrase) {

        if (!node) {
            return false;
        }

        switch (node.phraseType) {
            case PhraseType.ClassDeclarationHeader:
            case PhraseType.TraitDeclarationHeader:
            case PhraseType.InterfaceDeclarationHeader:
            case PhraseType.PropertyElement:
            case PhraseType.ConstElement:
            case PhraseType.ParameterDeclaration:
            case PhraseType.FunctionDeclarationHeader:
            case PhraseType.MethodDeclarationHeader:
            case PhraseType.ClassConstElement:
                return true;
            default:
                return false;
        }
    }

}
