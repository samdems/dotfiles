/* Copyright (c) Ben Robert Mewburn
 * Licensed under the ISC Licence.
 */

'use strict';

import {ParsedDocument} from './parsedDocument';
import {SymbolTable} from './symbolStore';
import {PhpSymbol, SymbolKind, SymbolModifier, SymbolIdentifier } from './symbol';
import {Position, TextEdit, Range} from 'vscode-languageserver-types';
import {TreeVisitor} from './types';
import {Phrase, Token, PhraseType, TokenType} from 'php7parser';
import * as util from './util';

export class UseDeclarationHelper {

    private _useDeclarations:PhpSymbol[];
    private _afterNode:Phrase;
    private _afterNodeRange:Range;
    private _cursor:Position;

    constructor(public doc:ParsedDocument, public table:SymbolTable, cursor:Position) { 
        this._useDeclarations = table.filter(this._isUseDeclarationSymbol);
        this._cursor = cursor;
    }

    insertDeclarationTextEdit(symbol:SymbolIdentifier, alias?:string) {
        let afterNode = this._insertAfterNode();

        let text = '\n';
        if(afterNode.phraseType === PhraseType.NamespaceDefinition){
            text += '\n';
        }

        text += util.whitespace(this._insertAfterNodeRange().start.character);
        text += 'use ';

        switch(symbol.kind) {
            case SymbolKind.Constant:
                text += 'const ';
                break;
            case SymbolKind.Function:
                text += 'function ';
                break;
            default:
                break;
        }

        text += symbol.name;

        if(alias) {
            text += ' as ' + alias;
        }

        text += ';';

        if(afterNode.phraseType !== PhraseType.NamespaceUseDeclaration) {
            text += '\n';
        }

        return TextEdit.insert(this._insertPosition(), text);

    }

    replaceDeclarationTextEdit(symbol:SymbolIdentifier, alias:string) {
        let useSymbol = this.findUseSymbolByFqn(symbol.name);
        let node = this.findNamespaceUseClauseByRange(useSymbol.location.range) as Phrase;
        let aliasingClause = ParsedDocument.findChild(node, this._isNamespaceAliasingClause) as Phrase;

        if(aliasingClause) {
            return TextEdit.replace(this.doc.nodeRange(aliasingClause), `as ${alias}`);
        } else {
            return TextEdit.insert(this.doc.nodeRange(node).end, ` as ${alias}`);
        }
    }

    deleteDeclarationTextEdit(fqn:string) {

    }

    findUseSymbolByFqn(fqn:string) {
        let lcFqn = fqn.toLowerCase();
        let fn = (x:PhpSymbol) => {
            return x.associated && x.associated.length > 0 && x.associated[0].name.toLowerCase() === lcFqn;
        }
        return this._useDeclarations.find(fn);
    }

    findUseSymbolByName(name:string) {

        let lcName = name.toLowerCase();
        let fn = (x:PhpSymbol) => {
            return x.name.toLowerCase() === lcName;
        }

        return this._useDeclarations.find(fn);

    }

    findNamespaceUseClauseByRange(range:Range) {

        let fn = (x:Phrase | Token) => {
            return ((<Phrase>x).phraseType === PhraseType.NamespaceUseClause || (<Phrase>x).phraseType === PhraseType.NamespaceUseGroupClause) &&
                util.rangeEquality(range, this.doc.nodeRange(x));
        };

        return this.doc.find(fn);

    }

    private _isUseDeclarationSymbol(s:PhpSymbol) {
        const mask = SymbolKind.Class | SymbolKind.Function | SymbolKind.Constant;
        return (s.modifiers & SymbolModifier.Use) > 0 && (s.kind & mask) > 0;
    }

    private _insertAfterNode() {

        if(this._afterNode) {
            return this._afterNode;
        }

        let visitor = new InsertAfterNodeVisitor(this.doc, this.doc.offsetAtPosition(this._cursor));
        this.doc.traverse(visitor);
        return this._afterNode = visitor.lastNamespaceUseDeclaration || visitor.namespaceDefinition || visitor.openingInlineText;
    }

    private _insertAfterNodeRange() {

        if(this._afterNodeRange) {
            return this._afterNodeRange;
        }

        return this._afterNodeRange = this.doc.nodeRange(this._insertAfterNode());

    }

    private _insertPosition() {
        return this._insertAfterNodeRange().end;
    }

    private _isNamespaceAliasingClause(node:Phrase|Token) {
        return (<Phrase>node).phraseType === PhraseType.NamespaceAliasingClause;
    }

}

class InsertAfterNodeVisitor implements TreeVisitor<Phrase | Token> {

    private _openingInlineText: Phrase;
    private _lastNamespaceUseDeclaration: Phrase;
    private _namespaceDefinition: Phrase;

    haltTraverse = false;
    haltAtOffset = -1;

    constructor(
        public document: ParsedDocument,
        offset: number) {
        this.haltAtOffset = offset;
    }

    get openingInlineText() {
        return this._openingInlineText;
    }

    get lastNamespaceUseDeclaration() {
        return this._lastNamespaceUseDeclaration;
    }

    get namespaceDefinition() {
        return this._namespaceDefinition;
    }

    preorder(node: Phrase | Token, spine: (Phrase | Token)[]) {

        switch ((<Phrase>node).phraseType) {
            case PhraseType.InlineText:
                if (!this._openingInlineText) {
                    this._openingInlineText = node as Phrase;
                }
                break;

            case PhraseType.NamespaceDefinition:
                if(!ParsedDocument.findChild(<Phrase>node, this._isStatementList)) {
                    this._namespaceDefinition = node as Phrase;
                }
                break;

            case PhraseType.NamespaceUseDeclaration:
                this._lastNamespaceUseDeclaration = node as Phrase;
                break;

            case undefined:
                //tokens
                if (this.haltAtOffset > -1 && ParsedDocument.isOffsetInToken(this.haltAtOffset, <Token>node)) {
                    this.haltTraverse = true;
                    return false;
                }
                break;

            default:
                break;

        }

        return true;

    }

    private _isStatementList(node:Phrase|Token) {
        return (<Phrase>node).phraseType === PhraseType.StatementList;
    }

}