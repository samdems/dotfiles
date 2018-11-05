/* Copyright (c) Ben Robert Mewburn
 * Licensed under the ISC Licence.
 */

'use strict';

import * as lsp from 'vscode-languageserver-types';
import { SymbolKind, PhpSymbol, SymbolModifier } from './symbol';
import { SymbolStore } from './symbolStore';
import { ParseTreeTraverser } from './parseTreeTraverser';
import { TypeString } from './typeString';
import { ParsedDocument, ParsedDocumentStore } from './parsedDocument';
import { Phrase, PhraseType, Token, TokenType, tokenTypeToString } from 'php7parser';
import * as util from './util';
import { MemberMergeStrategy } from './typeAggregate';
import { ReferenceStore } from './reference';


export class SignatureHelpProvider {

    constructor(public symbolStore: SymbolStore, public docStore: ParsedDocumentStore, public refStore: ReferenceStore) { }

    provideSignatureHelp(uri: string, position: lsp.Position) {

        const doc = this.docStore.find(uri);
        const table = this.symbolStore.getSymbolTable(uri);
        const refTable = this.refStore.getReferenceTable(uri);
        if (!doc || !table || !refTable) {
            return undefined;
        }

        const traverser = new ParseTreeTraverser(doc, table, refTable);
        const token = traverser.position(position);
        const prevToken = <Token>(ParsedDocument.isToken(token, [TokenType.CloseParenthesis]) ? token : traverser.clone().prevToken(true));
        const argExpList = traverser.ancestor(this._isArgExprList) as Phrase;
        const callableExpr = traverser.ancestor(this._isCallablePhrase) as Phrase;
        if (
            !token ||
            !prevToken ||
            (!argExpList && token.tokenType === TokenType.CloseParenthesis) ||
            (!argExpList && token.tokenType !== TokenType.OpenParenthesis && prevToken.tokenType !== TokenType.OpenParenthesis) ||
            !callableExpr
        ) {
            return undefined;
        }

        let symbol = this._getSymbol(traverser.clone());
        let delimFilterFn = (x: Phrase | Token) => {
            return (<Token>x).tokenType === TokenType.Comma && (<Token>x).offset <= token.offset;
        };
        let argNumber = ParsedDocument.filterChildren(argExpList, delimFilterFn).length;

        return symbol ? this._createSignatureHelp(symbol, argNumber) : undefined;

    }

    private _createSignatureHelp(fn: PhpSymbol, argNumber: number) {

        if (!fn.children) {
            return null;
        }

        let params = fn.children.filter((x) => {
            return x.kind === SymbolKind.Parameter;
        });

        if (!params.length || argNumber > params.length - 1) {
            return null;
        }

        let nOptionalParams = params.reduce<number>((carry, value) => {
            return value.value ? carry + 1 : carry;
        }, 0);

        let nRequiredParams = params.length - nOptionalParams;
        let signatures: lsp.SignatureInformation[] = [];

        if (nRequiredParams > 0) {
            signatures.push(this._signatureInfo(fn, params.slice(0, nRequiredParams)));
        }

        for (let n = 1; n <= nOptionalParams; ++n) {
            signatures.push(this._signatureInfo(fn, params.slice(0, nRequiredParams + n)));
        }

        let activeSig = signatures.findIndex((v) => {
            return v.parameters.length > argNumber;
        });

        return <lsp.SignatureHelp>{
            activeParameter: argNumber,
            activeSignature: activeSig,
            signatures: signatures
        };
    }

    private _signatureInfo(fn: PhpSymbol, params: PhpSymbol[]) {

        let paramInfoArray = this._parameterInfoArray(params);
        let label = fn.name + '(';
        label += paramInfoArray.map((v) => {
            return v.label;
        }).join(', ');
        label += ')';

        let returnType = PhpSymbol.type(fn);
        if (returnType) {
            label += ': ' + returnType;
        }

        let info = <lsp.SignatureInformation>{
            label: label,
            parameters: paramInfoArray
        }

        if (fn.doc && fn.doc.description) {
            info.documentation = fn.doc.description;
        }

        return info;

    }

    private _parameterInfoArray(params: PhpSymbol[]) {

        let infos: lsp.ParameterInformation[] = [];
        for (let n = 0, l = params.length; n < l; ++n) {
            infos.push(this._parameterInfo(params[n]));
        }

        return infos;
    }

    private _parameterInfo(s: PhpSymbol) {

        let labelParts: string[] = [];
        let paramType = PhpSymbol.type(s);
        if (paramType) {
            labelParts.push(paramType);
        }

        labelParts.push(s.name);

        if (s.value) {
            labelParts.push('= ' + s.value);
        }

        let info = <lsp.ParameterInformation>{
            label: labelParts.join(' '),
        };

        if (s.doc && s.doc.description) {
            info.documentation = s.doc.description;
        }

        return info;
    }

    private _getSymbol(traverser: ParseTreeTraverser) {
        let expr = traverser.node as Phrase;
        switch (expr.phraseType) {
            case PhraseType.FunctionCallExpression:
                if (traverser.child(this._isNamePhrase)) {
                    return this.symbolStore.findSymbolsByReference(traverser.reference).shift();
                }
                return undefined;
            case PhraseType.MethodCallExpression:
                if (traverser.child(this._isMemberName) && traverser.child(this._isNameToken)) {
                    return this.symbolStore.findSymbolsByReference(traverser.reference, MemberMergeStrategy.Documented).shift();
                }
                return undefined;
            case PhraseType.ScopedCallExpression:
                if (traverser.child(this._isScopedMemberName) && traverser.child(this._isIdentifier)) {
                    return this.symbolStore.findSymbolsByReference(traverser.reference, MemberMergeStrategy.Documented).shift();
                }
                return undefined;
            case PhraseType.ObjectCreationExpression:
                if (traverser.child(this._isClassTypeDesignator) && traverser.child(this._isNamePhraseOrRelativeScope)) {
                    return this.symbolStore.findSymbolsByReference(traverser.reference, MemberMergeStrategy.Override).shift();
                }
                return undefined;

            default:
                throw new Error('Invalid Argument');
        }
    }

    private _isCallablePhrase(node: Phrase | Token) {
        switch ((<Phrase>node).phraseType) {
            case PhraseType.FunctionCallExpression:
            case PhraseType.MethodCallExpression:
            case PhraseType.ScopedCallExpression:
            case PhraseType.ObjectCreationExpression:
                return true;
            default:
                return false;
        }
    }

    private _isNamePhrase(node: Phrase | Token) {
        switch ((<Phrase>node).phraseType) {
            case PhraseType.FullyQualifiedName:
            case PhraseType.RelativeQualifiedName:
            case PhraseType.QualifiedName:
                return true;
            default:
                return false;
        }
    }

    private _isArgExprList(node: Phrase | Token) {
        return (<Phrase>node).phraseType === PhraseType.ArgumentExpressionList;
    }

    private _isMemberName(node: Phrase | Token) {
        return (<Phrase>node).phraseType === PhraseType.MemberName;
    }

    private _isScopedMemberName(node: Phrase | Token) {
        return (<Phrase>node).phraseType === PhraseType.ScopedMemberName;
    }

    private _isNameToken(node: Phrase | Token) {
        return (<Token>node).tokenType === TokenType.Name;
    }

    private _isIdentifier(node: Phrase | Token) {
        return (<Phrase>node).phraseType === PhraseType.Identifier;
    }

    private _isClassTypeDesignator(node: Phrase | Token) {
        return (<Phrase>node).phraseType === PhraseType.ClassTypeDesignator;
    }

    private _isNamePhraseOrRelativeScope(node: Phrase | Token) {
        switch ((<Phrase>node).phraseType) {
            case PhraseType.FullyQualifiedName:
            case PhraseType.RelativeQualifiedName:
            case PhraseType.QualifiedName:
            case PhraseType.RelativeScope:
                return true;
            default:
                return false;
        }
    }

}