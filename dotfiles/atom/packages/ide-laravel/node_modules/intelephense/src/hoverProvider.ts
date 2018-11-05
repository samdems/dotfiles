/* Copyright (c) Ben Robert Mewburn
 * Licensed under the ISC Licence.
 */

'use strict';

import { ParsedDocumentStore } from './parsedDocument';
import { SymbolStore } from './symbolStore';
import { SymbolKind, PhpSymbol, SymbolModifier } from './symbol';
import { ReferenceStore } from './reference';
import { Position, Hover } from 'vscode-languageserver-types';
import { MemberMergeStrategy } from './typeAggregate';

export class HoverProvider {

    constructor(public docStore: ParsedDocumentStore, public symbolStore: SymbolStore, public refStore: ReferenceStore) {

    }


    provideHover(uri: string, pos: Position): Hover {


        let doc = this.docStore.find(uri);
        let table = this.refStore.getReferenceTable(uri);

        if (!doc || !table) {
            return undefined;
        }

        let ref = table.referenceAtPosition(pos);

        if (!ref) {
            return undefined;
        }

        let symbol = this.symbolStore.findSymbolsByReference(ref, MemberMergeStrategy.Override).shift();

        if (!symbol) {
            return undefined;
        }

        switch (symbol.kind) {

            case SymbolKind.Function:
            case SymbolKind.Method:
                return {
                    contents: [this.modifiersToString(symbol.modifiers), symbol.name + PhpSymbol.signatureString(symbol)].join(' ').trim(),
                    range: ref.location.range
                };

            case SymbolKind.Parameter:
                return {
                    contents: [PhpSymbol.type(symbol) || 'mixed', symbol.name].join(' ').trim(),
                    range: ref.location.range
                };

            case SymbolKind.Property:
                return {
                    contents: [this.modifiersToString(symbol.modifiers), PhpSymbol.type(symbol) || 'mixed', symbol.name].join(' ').trim(),
                    range: ref.location.range
                };

            case SymbolKind.Variable:
                return {
                    contents: [ref.type, symbol.name].join(' ').trim(),
                    range: ref.location.range
                };

            case SymbolKind.Constant:
            case SymbolKind.ClassConstant:
                return {
                    contents: [this.modifiersToString(symbol.modifiers), 'const', symbol.name, symbol.value ? `= ${symbol.value}` : ''].join(' ').trim(),
                    range: ref.location.range
                }

            default:
                return undefined;

        }


    }

    private modifiersToString(modifiers: SymbolModifier) {

        let modStrings: string[] = [];

        if (modifiers & SymbolModifier.Public) {
            modStrings.push('public');
        }

        if (modifiers & SymbolModifier.Protected) {
            modStrings.push('protected');
        }

        if (modifiers & SymbolModifier.Private) {
            modStrings.push('private');
        }

        if (modifiers & SymbolModifier.Final) {
            modStrings.push('final');
        }

        if (modifiers & SymbolModifier.Abstract) {
            modStrings.push('abstract');
        }

        return modStrings.join(' ');

    }

}