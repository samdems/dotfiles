/* Copyright (c) Ben Robert Mewburn
 * Licensed under the ISC Licence.
 */

'use strict';

import { ParsedDocumentStore } from './parsedDocument';
import { SymbolStore } from './symbolStore';
import { SymbolKind, PhpSymbol, SymbolModifier } from './symbol';
import { ReferenceStore } from './reference';
import { Position, DocumentHighlight, DocumentHighlightKind } from 'vscode-languageserver-types';
import { MemberMergeStrategy } from './typeAggregate';

export class HighlightProvider {

    constructor(public docStore: ParsedDocumentStore, public symbolStore: SymbolStore, public refStore: ReferenceStore) { }


    provideHightlights(uri:string, pos:Position) {


        let doc = this.docStore.find(uri);
        let table = this.refStore.getReferenceTable(uri);

        if (!doc || !table) {
            return undefined;
        }

        let ref = table.referenceAtPosition(pos);

        if (!ref) {
            return [];
        }

        //todo make this smarter
        let kindMask = SymbolKind.Parameter | SymbolKind.Variable;
        return table.references((r) => {
            return (r.kind === ref.kind || ((ref.kind & kindMask) > 0 && (r.kind & kindMask) > 0)) && ref.name === r.name;
        }).map((r) => {
            return DocumentHighlight.create(r.location.range, DocumentHighlightKind.Read);
        });

    }


}