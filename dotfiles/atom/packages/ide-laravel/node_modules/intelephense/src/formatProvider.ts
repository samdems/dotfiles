/* Copyright (c) Ben Robert Mewburn
 * Licensed under the ISC Licence.
 */

'use strict';

import * as lsp from 'vscode-languageserver-types';
import { TreeVisitor } from './types'
import { Phrase, Token, PhraseType, TokenType } from 'php7parser';
import { ParsedDocument, ParsedDocumentStore } from './parsedDocument';

interface FormatRule {
    (previous: Token, doc: ParsedDocument, indentText: string, indentUnit: string): lsp.TextEdit;
}

export class FormatProvider {

    private static blkLinePattern = /^(\r\n|\r|\n){2}$/;

    constructor(public docStore: ParsedDocumentStore) { }

    provideDocumentFormattingEdits(doc: lsp.TextDocumentIdentifier, formatOptions: lsp.FormattingOptions): lsp.TextEdit[] {

        let parsedDoc = this.docStore.find(doc.uri);

        if (!parsedDoc) {
            return [];
        }

        let visitor = new FormatVisitor(parsedDoc, formatOptions);
        parsedDoc.traverse(visitor);
        let edits = visitor.edits;
        let text = parsedDoc.text;

        if (
            visitor.firstToken &&
            visitor.firstToken.tokenType === TokenType.OpenTag &&
            visitor.OpenTagCount === 1
        ) {
            //must omit close tag if php only and end in blank line
            let closeTagIndex = visitor.last3Tokens.findIndex(this._isCloseTag);
            let endEdit: lsp.TextEdit;
            let lastToken = visitor.last3Tokens.length ? visitor.last3Tokens[visitor.last3Tokens.length - 1] : undefined;
            let lastTokenText = parsedDoc.tokenText(lastToken);

            if (closeTagIndex < 0) {
                //last token should be \n\n
                if (lastToken && lastToken.tokenType === TokenType.Whitespace && lastTokenText.search(FormatProvider.blkLinePattern) < 0) {
                    endEdit = lsp.TextEdit.replace(parsedDoc.tokenRange(lastToken), '\n\n');
                } else if (lastToken && lastToken.tokenType !== TokenType.Whitespace) {
                    endEdit = lsp.TextEdit.insert(parsedDoc.tokenRange(lastToken).end, '\n\n');
                }
            } else if (closeTagIndex > 0 && (lastToken.tokenType === TokenType.CloseTag || (lastToken.tokenType === TokenType.Text && !lastTokenText.trim()))) {
                let tokenBeforeClose = visitor.last3Tokens[closeTagIndex - 1];
                let replaceStart: lsp.Position;
                if (tokenBeforeClose.tokenType === TokenType.Whitespace) {
                    replaceStart = parsedDoc.tokenRange(tokenBeforeClose).start;
                } else {
                    replaceStart = parsedDoc.tokenRange(visitor.last3Tokens[closeTagIndex]).start;
                }
                endEdit = lsp.TextEdit.replace({ start: replaceStart, end: parsedDoc.tokenRange(lastToken).end }, '\n\n');
                if (edits.length) {
                    let lastEdit = edits[edits.length - 1];
                    if (lastEdit.range.end.line > endEdit.range.start.line ||
                        (lastEdit.range.end.line === endEdit.range.start.line && lastEdit.range.end.character > endEdit.range.start.character)) {
                        edits.shift();
                    }
                }
                
            }

            if(endEdit) {
                edits.unshift(endEdit);
            }

        }

        return edits;
    }

    provideDocumentRangeFormattingEdits(doc: lsp.TextDocumentIdentifier, range: lsp.Range, formatOptions: lsp.FormattingOptions): lsp.TextEdit[] {

        let parsedDoc = this.docStore.find(doc.uri);

        if (!parsedDoc) {
            return [];
        }

        let visitor = new FormatVisitor(parsedDoc, formatOptions, range);
        parsedDoc.traverse(visitor);
        return visitor.edits;

    }

    private _isCloseTag(t: Token) {
        return t.tokenType === TokenType.CloseTag;
    }

}

class FormatVisitor implements TreeVisitor<Phrase | Token> {

    private _edits: lsp.TextEdit[];
    private _previousToken: Token;
    private _previousNonWsToken: Token;
    private _nextFormatRule: FormatRule;
    private _isMultilineCommaDelimitedListStack: boolean[];
    private _indentUnit: string;
    private _indentText = '';
    private static _docBlockRegex = /(?:\r\n|\r|\n)[ \t]*\*/g;
    private _startOffset = -1;
    private _endOffset = -1;
    private _active = true;
    private _lastParameterListWasMultiLine = false;

    private static memberAccessExprTypes = [
        PhraseType.MethodCallExpression, PhraseType.PropertyAccessExpression, 
        PhraseType.ScopedCallExpression, PhraseType.ClassConstantAccessExpression, PhraseType.ScopedPropertyAccessExpression
    ];

    private _decrementOnTheseNodes:Phrase[];

    firstToken: Token;
    last3Tokens: Token[];
    OpenTagCount = 0;

    haltTraverse: boolean;

    constructor(
        public doc: ParsedDocument,
        public formatOptions: lsp.FormattingOptions,
        range?: lsp.Range) {
        this._edits = [];
        this._isMultilineCommaDelimitedListStack = [];
        this._indentUnit = formatOptions.insertSpaces ? FormatVisitor.createWhitespace(formatOptions.tabSize, ' ') : '\t';
        if (range) {
            this._startOffset = this.doc.offsetAtPosition(range.start);
            this._endOffset = this.doc.offsetAtPosition(range.end);
            this._active = false;
        }
        this.last3Tokens = [];
        this._decrementOnTheseNodes = [];
    }

    get edits() {
        return this._edits.reverse();
    }

    preorder(node: Phrase | Token, spine: (Phrase | Token)[]) {

        let parent = spine.length ? <Phrase>spine[spine.length - 1] : <Phrase>{ phraseType: PhraseType.Unknown, children: [] };

        switch ((<Phrase>node).phraseType) {

            //newline indent before {
            case PhraseType.FunctionDeclarationBody:
                if (parent.phraseType === PhraseType.AnonymousFunctionCreationExpression || this._lastParameterListWasMultiLine) {
                    this._nextFormatRule = FormatVisitor.singleSpaceBefore;
                    this._lastParameterListWasMultiLine = false;
                } else {
                    this._nextFormatRule = FormatVisitor.newlineIndentBefore;
                }
                return true;

            case PhraseType.MethodDeclarationBody:
                if(this._lastParameterListWasMultiLine) {
                    this._nextFormatRule = FormatVisitor.singleSpaceBefore;
                    this._lastParameterListWasMultiLine = false;
                } else {
                    this._nextFormatRule = FormatVisitor.newlineIndentBefore;
                }

                return true;

            case PhraseType.ClassDeclarationBody:
            case PhraseType.TraitDeclarationBody:
            case PhraseType.InterfaceDeclarationBody:
                this._nextFormatRule = FormatVisitor.newlineIndentBefore;
                return true;

            //comma delim lists
            case PhraseType.ParameterDeclarationList:
            case PhraseType.ArgumentExpressionList:
            case PhraseType.ClosureUseList:
            case PhraseType.ArrayInitialiserList:
            case PhraseType.QualifiedNameList:
                if (
                    (this._previousToken &&
                        this._previousToken.tokenType === TokenType.Whitespace &&
                        FormatVisitor.countNewlines(this.doc.tokenText(this._previousToken)) > 0) ||
                    this._hasNewlineWhitespaceChild(<Phrase>node)
                ) {
                    this._nextFormatRule = FormatVisitor.newlineIndentBefore;
                    this._isMultilineCommaDelimitedListStack.push(true);
                    this._incrementIndent();
                } else {
                    this._isMultilineCommaDelimitedListStack.push(false);
                    if ((<Phrase>node).phraseType !== PhraseType.QualifiedNameList) {
                        this._nextFormatRule = FormatVisitor.noSpaceBefore;
                    }
                }
                return true;

            case PhraseType.ConstElementList:
            case PhraseType.ClassConstElementList:
            case PhraseType.PropertyElementList:
            case PhraseType.StaticVariableDeclarationList:
            case PhraseType.VariableNameList:
                if (
                    (this._previousToken &&
                        this._previousToken.tokenType === TokenType.Whitespace &&
                        FormatVisitor.countNewlines(this.doc.tokenText(this._previousToken)) > 0) ||
                    this._hasNewlineWhitespaceChild(<Phrase>node)
                ) {
                    this._isMultilineCommaDelimitedListStack.push(true);
                    this._incrementIndent();
                } else {
                    this._isMultilineCommaDelimitedListStack.push(false);
                }
                this._nextFormatRule = FormatVisitor.singleSpaceOrNewlineIndentBefore;
                return true;

            case PhraseType.EncapsulatedVariableList:
                this._nextFormatRule = FormatVisitor.noSpaceBefore;
                return true;

            case PhraseType.SimpleVariable:
                if (parent.phraseType === PhraseType.EncapsulatedVariableList) {
                    this._nextFormatRule = FormatVisitor.noSpaceBefore;
                }
                return true;

            case undefined:
                //tokens
                break;

            default:
                if (parent.phraseType === PhraseType.EncapsulatedVariableList) {
                    this._nextFormatRule = FormatVisitor.noSpaceBefore;
                }
                return true;
        }

        let rule = this._nextFormatRule;
        let previous = this._previousToken;
        let previousNonWsToken = this._previousNonWsToken;
        this._previousToken = node as Token;
        if (this._previousToken.tokenType !== TokenType.Whitespace) {
            this._previousNonWsToken = this._previousToken;
        }

        if (!this.firstToken) {
            this.firstToken = this._previousToken;
        }

        this.last3Tokens.push(this._previousToken);
        if (this.last3Tokens.length > 3) {
            this.last3Tokens.shift();
        }

        if (this._previousToken.tokenType === TokenType.OpenTag || this._previousToken.tokenType === TokenType.OpenTagEcho) {
            this.OpenTagCount++;
        }

        this._nextFormatRule = null;

        if (!this._active && this._startOffset > -1 && ParsedDocument.isOffsetInToken(this._startOffset, <Token>node)) {
            this._active = true;
        }

        if (!previous) {
            return false;
        }

        switch ((<Token>node).tokenType) {

            case TokenType.Whitespace:
                this._nextFormatRule = rule;
                return false;

            case TokenType.Comment:
                return false;

            case TokenType.DocumentComment:
                rule = FormatVisitor.newlineIndentBefore;
                break;

            case TokenType.PlusPlus:
                if (parent.phraseType === PhraseType.PostfixIncrementExpression) {
                    rule = FormatVisitor.noSpaceBefore;
                }
                break;

            case TokenType.MinusMinus:
                if (parent.phraseType === PhraseType.PostfixDecrementExpression) {
                    rule = FormatVisitor.noSpaceBefore;
                }
                break;

            case TokenType.Backslash:
                if (parent.phraseType === PhraseType.NamespaceName) {
                    rule = FormatVisitor.noSpaceBefore;
                }
                break;

            case TokenType.VariableName:
                if(previousNonWsToken.tokenType === TokenType.Dollar) {
                    rule = FormatVisitor.noSpaceBefore;
                }
                break;

            case TokenType.Semicolon:
            case TokenType.Comma:
            case TokenType.Text:
            case TokenType.EncapsulatedAndWhitespace:
            case TokenType.DollarCurlyOpen:
            case TokenType.CurlyOpen:
                rule = FormatVisitor.noSpaceBefore;
                break;

            case TokenType.OpenBrace:
                if(previousNonWsToken && previousNonWsToken.tokenType === TokenType.Dollar) {
                    rule = FormatVisitor.noSpaceBefore;
                } else if(!rule) {
                    rule = FormatVisitor.singleSpaceBefore;
                }
                break;

            case TokenType.Colon:
                if(parent.phraseType === PhraseType.CaseStatement || parent.phraseType === PhraseType.DefaultStatement) {
                    rule = FormatVisitor.noSpaceBefore;
                }
                break;

            case TokenType.OpenTag:
            case TokenType.OpenTagEcho:
                rule = FormatVisitor.noSpaceBefore;
                this._indentText = FormatVisitor.createWhitespace(
                    Math.ceil((this.doc.lineSubstring((<Token>node).offset).length - 1) / this._indentUnit.length),
                    this._indentUnit
                );
                break;

            case TokenType.Else:
            case TokenType.ElseIf:
                if (previousNonWsToken && previousNonWsToken.tokenType === TokenType.CloseBrace) {
                    rule = FormatVisitor.singleSpaceBefore;
                }
                break;

            case TokenType.Name:
                if(parent.phraseType === PhraseType.PropertyAccessExpression || previousNonWsToken.tokenType === TokenType.Backslash) {
                    rule = FormatVisitor.noSpaceBefore;
                }
                break;

            case TokenType.While:
                if (parent.phraseType === PhraseType.DoStatement) {
                    rule = FormatVisitor.singleSpaceBefore;
                }
                break;

            case TokenType.Catch:
                rule = FormatVisitor.singleSpaceBefore;
                break;

            case TokenType.Arrow:
            case TokenType.ColonColon:
                if(previous && previous.tokenType === TokenType.Whitespace && FormatVisitor.countNewlines(this.doc.tokenText(previous)) > 0) {
                    //get the outer member access expr
                    let outerExpr = parent;
                    for(let n = spine.length - 2; n >= 0; --n) {
                        if(ParsedDocument.isPhrase(spine[n], FormatVisitor.memberAccessExprTypes)) {
                            outerExpr = spine[n] as Phrase;
                        } else {
                            break;
                        }
                    }
                    if(!this._decrementOnTheseNodes.find((x)=>{ return x === outerExpr})) {
                        this._decrementOnTheseNodes.push(outerExpr);
                        this._incrementIndent();
                    }
                }
                rule = FormatVisitor.noSpaceOrNewlineIndentBefore;
                break;

            case TokenType.OpenParenthesis:
                if (this._shouldOpenParenthesisHaveNoSpaceBefore(parent, previousNonWsToken)) {
                    rule = FormatVisitor.noSpaceBefore;
                } else if(!rule) {
                    rule = FormatVisitor.singleSpaceBefore;
                }
                break;

            case TokenType.OpenBracket:
                if (parent.phraseType === PhraseType.SubscriptExpression) {
                    rule = FormatVisitor.noSpaceBefore;
                }
                break;

            case TokenType.CloseBrace:
                this._decrementIndent();
                if (
                    parent.phraseType === PhraseType.SubscriptExpression ||
                    parent.phraseType === PhraseType.EncapsulatedExpression ||
                    parent.phraseType === PhraseType.EncapsulatedVariable
                ) {
                    rule = FormatVisitor.noSpaceBefore;
                } else {
                    rule = FormatVisitor.newlineIndentBefore;
                }
                break;

            case TokenType.CloseBracket:
            case TokenType.CloseParenthesis:
                if (!rule) {
                    rule = FormatVisitor.noSpaceBefore;
                }
                break;

            case TokenType.CloseTag:
                if (previous.tokenType === TokenType.Comment && this.doc.tokenText(previous).slice(0, 2) !== '/*') {
                    rule = FormatVisitor.noSpaceBefore;
                } else if (rule !== FormatVisitor.indentOrNewLineIndentBefore) {
                    rule = FormatVisitor.singleSpaceOrNewlineIndentBefore;
                }
                break;

            default:
                break;
        }

        if (!rule) {
            rule = FormatVisitor.singleSpaceOrNewlineIndentPlusOneBefore;
        }

        if (!this._active) {
            return false;
        }

        let edit = rule(previous, this.doc, this._indentText, this._indentUnit);
        if (edit) {
            this._edits.push(edit);
        }

        //keywords should be lowercase
        if (this._isKeyword(<Token>node)) {
            let text = this.doc.tokenText(<Token>node);
            let lcText = text.toLowerCase();
            if (text !== lcText) {
                this._edits.push(lsp.TextEdit.replace(this.doc.tokenRange(<Token>node), lcText));
            }
        } else if(this._isTrueFalseNull(<Token>node, spine)) {
            let text = this.doc.tokenText(<Token>node);
            let lcText = text.toLowerCase();
            if (text !== lcText) {
                this._edits.push(lsp.TextEdit.replace(this.doc.tokenRange(<Token>node), lcText));
            }
        }

        return false;
    }

    postorder(node: Phrase | Token, spine: (Phrase | Token)[]) {

        let parent = spine[spine.length - 1] as Phrase;

        let decrementOnNode = this._decrementOnTheseNodes.length ? this._decrementOnTheseNodes[this._decrementOnTheseNodes.length - 1] : undefined;
        if(decrementOnNode === node) {
            this._decrementIndent();
            this._decrementOnTheseNodes.pop();
        }

        switch ((<Phrase>node).phraseType) {
            case PhraseType.CaseStatement:
            case PhraseType.DefaultStatement:
                this._decrementIndent();
                return;

            case PhraseType.NamespaceDefinition:
                this._nextFormatRule = FormatVisitor.doubleNewlineIndentBefore;
                return;

            case PhraseType.NamespaceUseDeclaration:
                if (this._isLastNamespaceUseDeclaration(parent, <Phrase>node)) {
                    this._nextFormatRule = FormatVisitor.doubleNewlineIndentBefore;
                }
                return;

            case PhraseType.ParameterDeclarationList:
            case PhraseType.ArgumentExpressionList:
            case PhraseType.ClosureUseList:
            case PhraseType.QualifiedNameList:
            case PhraseType.ArrayInitialiserList:
                if (this._isMultilineCommaDelimitedListStack.pop()) {
                    this._nextFormatRule = FormatVisitor.newlineIndentBefore;
                    this._decrementIndent();
                    if((<Phrase>node).phraseType === PhraseType.ParameterDeclarationList) {
                        this._lastParameterListWasMultiLine = true;
                    }
                }
                return;

            case PhraseType.ConstElementList:
            case PhraseType.PropertyElementList:
            case PhraseType.ClassConstElementList:
            case PhraseType.StaticVariableDeclarationList:
            case PhraseType.VariableNameList:
                if (this._isMultilineCommaDelimitedListStack.pop()) {
                    this._decrementIndent();
                }
                return;

            case PhraseType.EncapsulatedVariableList:
                this._nextFormatRule = FormatVisitor.noSpaceBefore;
                return;

            case PhraseType.AnonymousFunctionCreationExpression:
                this._nextFormatRule = null;
                break;

            case undefined:
                //tokens
                break;

            default:
                return;
        }

        switch ((<Token>node).tokenType) {

            case TokenType.Comment:
                if (this.doc.tokenText(<Token>node).slice(0, 2) === '/*') {
                    this._nextFormatRule = FormatVisitor.singleSpaceOrNewlineIndentBefore;
                    if (this._active) {
                        let edit = this._formatDocBlock(<Token>node);
                        if (edit) {
                            this._edits.push(edit);
                        }
                    }

                } else {
                    this._nextFormatRule = FormatVisitor.indentOrNewLineIndentBefore;
                }
                break;

            case TokenType.DocumentComment:
                this._nextFormatRule = FormatVisitor.newlineIndentBefore;
                if (!this._active) {
                    break;
                }
                let edit = this._formatDocBlock(<Token>node);
                if (edit) {
                    this._edits.push(edit);
                }
                break;

            case TokenType.OpenBrace:
                if (parent.phraseType === PhraseType.EncapsulatedExpression) {
                    this._nextFormatRule = FormatVisitor.noSpaceBefore;
                } else {
                    this._nextFormatRule = FormatVisitor.newlineIndentBefore;
                }

                this._incrementIndent();
                break;

            case TokenType.CloseBrace:
                if (parent.phraseType !== PhraseType.EncapsulatedVariable &&
                    parent.phraseType !== PhraseType.EncapsulatedExpression &&
                    parent.phraseType !== PhraseType.SubscriptExpression
                ) {
                    this._nextFormatRule = FormatVisitor.newlineIndentBefore;
                }
                break;

            case TokenType.Semicolon:
                if (parent.phraseType === PhraseType.ForStatement) {
                    this._nextFormatRule = FormatVisitor.singleSpaceBefore;
                } else {
                    this._nextFormatRule = FormatVisitor.newlineIndentBefore;
                }
                break;

            case TokenType.Colon:
                if (this._shouldIndentAfterColon(<Phrase>spine[spine.length - 1])) {
                    this._incrementIndent();
                    this._nextFormatRule = FormatVisitor.newlineIndentBefore;
                }

                break;

            case TokenType.Ampersand:
                if (parent.phraseType !== PhraseType.BitwiseExpression) {
                    this._nextFormatRule = FormatVisitor.noSpaceBefore;
                }
                break;

            case TokenType.Plus:
            case TokenType.Minus:
                if (parent.phraseType === PhraseType.UnaryOpExpression) {
                    this._nextFormatRule = FormatVisitor.noSpaceBefore;
                }
                break;

            case TokenType.PlusPlus:
                if (parent.phraseType === PhraseType.PrefixIncrementExpression) {
                    this._nextFormatRule = FormatVisitor.noSpaceBefore;
                }
                break;

            case TokenType.MinusMinus:
                if (parent.phraseType === PhraseType.PrefixDecrementExpression) {
                    this._nextFormatRule = FormatVisitor.noSpaceBefore;
                }
                break;

            case TokenType.Ellipsis:
            case TokenType.Exclamation:
            case TokenType.AtSymbol:
            case TokenType.ArrayCast:
            case TokenType.BooleanCast:
            case TokenType.FloatCast:
            case TokenType.IntegerCast:
            case TokenType.ObjectCast:
            case TokenType.StringCast:
            case TokenType.UnsetCast:
            case TokenType.Tilde:
            case TokenType.Backslash:
            case TokenType.OpenParenthesis:
            case TokenType.OpenBracket:
                this._nextFormatRule = FormatVisitor.noSpaceBefore;
                break;

            case TokenType.CurlyOpen:
            case TokenType.DollarCurlyOpen:
                this._incrementIndent();
                this._nextFormatRule = FormatVisitor.noSpaceBefore;
                break;

            case TokenType.Comma:
                if (
                    parent.phraseType === PhraseType.ArrayInitialiserList ||
                    parent.phraseType === PhraseType.ConstElementList ||
                    parent.phraseType === PhraseType.ClassConstElementList ||
                    parent.phraseType === PhraseType.PropertyElementList ||
                    parent.phraseType === PhraseType.StaticVariableDeclarationList ||
                    parent.phraseType === PhraseType.VariableNameList
                ) {
                    this._nextFormatRule = FormatVisitor.singleSpaceOrNewlineIndentBefore;
                } else if (
                    this._isMultilineCommaDelimitedListStack.length > 0 &&
                    this._isMultilineCommaDelimitedListStack[this._isMultilineCommaDelimitedListStack.length - 1]
                ) {
                    this._nextFormatRule = FormatVisitor.newlineIndentBefore;
                }
                break;

            case TokenType.Arrow:
            case TokenType.ColonColon:
                this._nextFormatRule = FormatVisitor.noSpaceBefore;
                break;

            case TokenType.OpenTag:
                let tagText = this.doc.tokenText(<Token>node);
                if (tagText.length > 2) {
                    if (FormatVisitor.countNewlines(tagText) > 0) {
                        this._nextFormatRule = FormatVisitor.indentOrNewLineIndentBefore;
                    } else {
                        this._nextFormatRule = FormatVisitor.noSpaceOrNewlineIndentBefore;
                    }
                    break;
                }

            //fall through
            case TokenType.OpenTagEcho:
                this._nextFormatRule = FormatVisitor.singleSpaceOrNewlineIndentBefore;
                break;

            default:
                break;

        }

        if (this._active && this._endOffset > -1 && ParsedDocument.isOffsetInToken(this._endOffset, <Token>node)) {
            this.haltTraverse = true;
            this._active = false;
        }

    }

    private _isTrueFalseNull(node:Token, spine:(Phrase|Token)[]) {
        let parent = spine.length ? spine[spine.length - 1] : undefined;
        let greatGrandParent = spine.length > 2 ? spine[spine.length - 3] : undefined;
        const keywords = ['true', 'false', 'null'];
        return ParsedDocument.isToken(node, [TokenType.Name]) && 
            ParsedDocument.isPhrase(parent, [PhraseType.NamespaceName]) &&
            (<Phrase>parent).children.length === 1 &&
            ParsedDocument.isPhrase(greatGrandParent, [PhraseType.ConstantAccessExpression]) &&
            keywords.indexOf(this.doc.tokenText(node).toLowerCase()) > -1;
    }

    private _formatDocBlock(node: Token) {
        let text = this.doc.tokenText(node);
        let formatted = text.replace(FormatVisitor._docBlockRegex, '\n' + this._indentText + ' *');
        return formatted !== text ? lsp.TextEdit.replace(this.doc.tokenRange(node), formatted) : null;
    }

    private _incrementIndent() {
        this._indentText += this._indentUnit;
    }

    private _decrementIndent() {
        this._indentText = this._indentText.slice(0, -this._indentUnit.length);
    }

    private _hasNewlineWhitespaceChild(phrase: Phrase) {
        for (let n = 0, l = phrase.children.length; n < l; ++n) {
            if (
                (<Token>phrase.children[n]).tokenType === TokenType.Whitespace &&
                FormatVisitor.countNewlines(this.doc.tokenText(<Token>phrase.children[n])) > 0
            ) {
                return true;
            }
        }
        return false;
    }

    private _isLastNamespaceUseDeclaration(parent: Phrase, child: Phrase) {

        let i = parent.children.indexOf(child);
        while (i < parent.children.length) {
            ++i;
            child = parent.children[i] as Phrase;
            if (child.phraseType) {
                return child.phraseType !== PhraseType.NamespaceUseDeclaration;
            }
        }

        return true;

    }

    private _shouldIndentAfterColon(parent: Phrase) {
        switch (parent.phraseType) {
            case PhraseType.CaseStatement:
            case PhraseType.DefaultStatement:
                return true;
            default:
                return false;
        }
    }

    private _shouldOpenParenthesisHaveNoSpaceBefore(parent: Phrase, lastNonWsToken:Token) {
        switch (parent.phraseType) {
            case PhraseType.FunctionCallExpression:
            case PhraseType.MethodCallExpression:
            case PhraseType.ScopedCallExpression:
            case PhraseType.EchoIntrinsic:
            case PhraseType.EmptyIntrinsic:
            case PhraseType.EvalIntrinsic:
            case PhraseType.ExitIntrinsic:
            case PhraseType.IssetIntrinsic:
            case PhraseType.ListIntrinsic:
            case PhraseType.PrintIntrinsic:
            case PhraseType.UnsetIntrinsic:
            case PhraseType.ArrayCreationExpression:
            case PhraseType.FunctionDeclarationHeader:
            case PhraseType.MethodDeclarationHeader:
            case PhraseType.ObjectCreationExpression:
            case PhraseType.RequireExpression:
            case PhraseType.RequireOnceExpression:
            case PhraseType.IncludeExpression:
            case PhraseType.IncludeOnceExpression:
                return true;
            default:
                if(!lastNonWsToken) {
                    return false;
                }
                break;
        }

        switch(lastNonWsToken.tokenType) {
            case TokenType.Require:
            case TokenType.RequireOnce:
            case TokenType.Include:
            case TokenType.IncludeOnce:
            case TokenType.Isset:
            case TokenType.List:
            case TokenType.Print:
            case TokenType.Unset:
            case TokenType.Eval:
            case TokenType.Exit:
            case TokenType.Empty:
                return true;
            default:
                return false;
        }
        
    }

    private _hasColonChild(phrase: Phrase) {

        for (let n = 0, l = phrase.children.length; n < l; ++n) {
            if ((<Token>phrase.children[n]).tokenType === TokenType.Colon) {
                return true;
            }
        }
        return false;

    }

    private _isKeyword(t: Token) {
        if (!t) {
            return false;
        }
        switch (t.tokenType) {
            case TokenType.Abstract:
            case TokenType.Array:
            case TokenType.As:
            case TokenType.Break:
            case TokenType.Callable:
            case TokenType.Case:
            case TokenType.Catch:
            case TokenType.Class:
            case TokenType.ClassConstant:
            case TokenType.Clone:
            case TokenType.Const:
            case TokenType.Continue:
            case TokenType.Declare:
            case TokenType.Default:
            case TokenType.Do:
            case TokenType.Echo:
            case TokenType.Else:
            case TokenType.ElseIf:
            case TokenType.Empty:
            case TokenType.EndDeclare:
            case TokenType.EndFor:
            case TokenType.EndForeach:
            case TokenType.EndIf:
            case TokenType.EndSwitch:
            case TokenType.EndWhile:
            case TokenType.Eval:
            case TokenType.Exit:
            case TokenType.Extends:
            case TokenType.Final:
            case TokenType.Finally:
            case TokenType.For:
            case TokenType.ForEach:
            case TokenType.Function:
            case TokenType.Global:
            case TokenType.Goto:
            case TokenType.HaltCompiler:
            case TokenType.If:
            case TokenType.Implements:
            case TokenType.Include:
            case TokenType.IncludeOnce:
            case TokenType.InstanceOf:
            case TokenType.InsteadOf:
            case TokenType.Interface:
            case TokenType.Isset:
            case TokenType.List:
            case TokenType.And:
            case TokenType.Or:
            case TokenType.Xor:
            case TokenType.Namespace:
            case TokenType.New:
            case TokenType.Print:
            case TokenType.Private:
            case TokenType.Public:
            case TokenType.Protected:
            case TokenType.Require:
            case TokenType.RequireOnce:
            case TokenType.Return:
            case TokenType.Static:
            case TokenType.Switch:
            case TokenType.Throw:
            case TokenType.Trait:
            case TokenType.Try:
            case TokenType.Unset:
            case TokenType.Use:
            case TokenType.Var:
            case TokenType.While:
            case TokenType.Yield:
            case TokenType.YieldFrom:
                return true;
            default:
                return false;
        }
    }

}

namespace FormatVisitor {

    export function singleSpaceBefore(previous: Token, doc: ParsedDocument, indentText: string, indentUnit: string): lsp.TextEdit {
        if (previous.tokenType !== TokenType.Whitespace) {
            return lsp.TextEdit.insert(doc.positionAtOffset(previous.offset + previous.length), ' ');
        }

        let actualWs = doc.tokenText(previous);
        let expectedWs = ' ';
        if (actualWs === expectedWs) {
            return null;
        }
        return lsp.TextEdit.replace(doc.tokenRange(previous), expectedWs);
    }

    export function indentBefore(previous: Token, doc: ParsedDocument, indentText: string, indentUnit: string): lsp.TextEdit {
        if (previous.tokenType !== TokenType.Whitespace) {
            return indentText ? lsp.TextEdit.insert(doc.positionAtOffset(previous.offset + previous.length), indentText) : null;
        }

        if (!indentText) {
            return lsp.TextEdit.del(doc.tokenRange(previous));
        }

        let actualWs = doc.tokenText(previous);
        if (actualWs === indentText) {
            return null;
        }
        return lsp.TextEdit.replace(doc.tokenRange(previous), indentText);
    }

    export function indentOrNewLineIndentBefore(previous: Token, doc: ParsedDocument, indentText: string, indentUnit: string): lsp.TextEdit {
        if (previous.tokenType !== TokenType.Whitespace) {
            return indentText ? lsp.TextEdit.insert(doc.positionAtOffset(previous.offset + previous.length), indentText) : null;
        }

        let actualWs = doc.tokenText(previous);
        let nl = countNewlines(actualWs);
        if (nl) {
            let expectedWs = createWhitespace(Math.max(1, nl), '\n') + indentText;
            if (actualWs === expectedWs) {
                return null;
            }
            return lsp.TextEdit.replace(doc.tokenRange(previous), expectedWs);
        }

        if (!indentText) {
            return lsp.TextEdit.del(doc.tokenRange(previous));
        }

        if (actualWs === indentText) {
            return null;
        }
        return lsp.TextEdit.replace(doc.tokenRange(previous), indentText);
    }

    export function newlineIndentBefore(previous: Token, doc: ParsedDocument, indentText: string, indentUnit: string): lsp.TextEdit {
        if (previous.tokenType !== TokenType.Whitespace) {
            return lsp.TextEdit.insert(doc.positionAtOffset(previous.offset + previous.length), '\n' + indentText);
        }

        let actualWs = doc.tokenText(previous);
        let expectedWs = createWhitespace(Math.max(1, countNewlines(actualWs)), '\n') + indentText;
        if (actualWs === expectedWs) {
            return null;
        }
        return lsp.TextEdit.replace(doc.tokenRange(previous), expectedWs);
    }

    export function doubleNewlineIndentBefore(previous: Token, doc: ParsedDocument, indentText: string, indentUnit: string): lsp.TextEdit {
        if (previous.tokenType !== TokenType.Whitespace) {
            return lsp.TextEdit.insert(doc.positionAtOffset(previous.offset + previous.length), '\n\n' + indentText);
        }

        let actualWs = doc.tokenText(previous);
        let expected = createWhitespace(Math.max(2, countNewlines(actualWs)), '\n') + indentText;
        if (actualWs === expected) {
            return null;
        }
        return lsp.TextEdit.replace(doc.tokenRange(previous), expected);
    }

    export function noSpaceBefore(previous: Token, doc: ParsedDocument, indentText: string, indentUnit: string): lsp.TextEdit {
        if (previous.tokenType !== TokenType.Whitespace) {
            return null;
        }
        return lsp.TextEdit.del(doc.tokenRange(previous));
    }

    export function noSpaceOrNewlineIndentPlusOneBefore(previous: Token, doc: ParsedDocument, indentText: string, indentUnit: string): lsp.TextEdit {
        if (previous.tokenType !== TokenType.Whitespace) {
            return null;
        }

        let actualWs = doc.tokenText(previous);
        let newlineCount = countNewlines(actualWs);
        if (!newlineCount) {
            return lsp.TextEdit.del(doc.tokenRange(previous));
        }

        let expectedWs = createWhitespace(newlineCount, '\n') + indentText + indentUnit;
        if (actualWs === expectedWs) {
            return null;
        }
        return lsp.TextEdit.replace(doc.tokenRange(previous), expectedWs);

    }

    export function noSpaceOrNewlineIndentBefore(previous: Token, doc: ParsedDocument, indentText: string, indentUnit: string): lsp.TextEdit {
        if (previous.tokenType !== TokenType.Whitespace) {
            return null;
        }

        let actualWs = doc.tokenText(previous);
        let newlineCount = countNewlines(actualWs);
        if (!newlineCount) {
            return lsp.TextEdit.del(doc.tokenRange(previous));
        }

        let expectedWs = createWhitespace(newlineCount, '\n') + indentText;
        if (actualWs === expectedWs) {
            return null;
        }
        return lsp.TextEdit.replace(doc.tokenRange(previous), expectedWs);

    }

    export function singleSpaceOrNewlineIndentPlusOneBefore(previous: Token, doc: ParsedDocument, indentText: string, indentUnit: string): lsp.TextEdit {

        if (previous.tokenType !== TokenType.Whitespace) {
            return lsp.TextEdit.insert(doc.positionAtOffset(previous.offset + previous.length), ' ');
        }

        let actualWs = doc.tokenText(previous);
        if (actualWs === ' ') {
            return null;
        }

        let newlineCount = countNewlines(actualWs);
        if (!newlineCount) {
            return lsp.TextEdit.replace(doc.tokenRange(previous), ' ');
        }

        let expectedWs = createWhitespace(newlineCount, '\n') + indentText + indentUnit;
        if (actualWs !== expectedWs) {
            return lsp.TextEdit.replace(doc.tokenRange(previous), expectedWs);
        }

        return null;

    }

    export function singleSpaceOrNewlineIndentBefore(previous: Token, doc: ParsedDocument, indentText: string, indentUnit: string): lsp.TextEdit {

        if (previous.tokenType !== TokenType.Whitespace) {
            return lsp.TextEdit.insert(doc.positionAtOffset(previous.offset + previous.length), ' ');
        }

        let actualWs = doc.tokenText(previous);
        if (actualWs === ' ') {
            return null;
        }

        let newlineCount = countNewlines(actualWs);
        if (!newlineCount) {
            return lsp.TextEdit.replace(doc.tokenRange(previous), ' ');
        }

        let expectedWs = createWhitespace(newlineCount, '\n') + indentText;
        if (actualWs !== expectedWs) {
            return lsp.TextEdit.replace(doc.tokenRange(previous), expectedWs);
        }

        return null;

    }

    export function createWhitespace(n: number, unit: string) {
        let text = '';
        while (n > 0) {
            text += unit;
            --n;
        }
        return text;
    }

    export function countNewlines(text: string) {

        let c: string;
        let count = 0;
        let l = text.length;
        let n = 0;

        while (n < l) {
            c = text[n];
            ++n;
            if (c === '\r') {
                ++count;
                if (n < l && text[n] === '\n') {
                    ++n;
                }
            } else if (c === '\n') {
                ++count;
            }

        }

        return count;

    }

}
