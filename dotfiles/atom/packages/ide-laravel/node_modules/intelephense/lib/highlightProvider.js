'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
class HighlightProvider {
    constructor(docStore, symbolStore, refStore) {
        this.docStore = docStore;
        this.symbolStore = symbolStore;
        this.refStore = refStore;
    }
    provideHightlights(uri, pos) {
        let doc = this.docStore.find(uri);
        let table = this.refStore.getReferenceTable(uri);
        if (!doc || !table) {
            return undefined;
        }
        let ref = table.referenceAtPosition(pos);
        if (!ref) {
            return [];
        }
        let kindMask = 128 | 256;
        return table.references((r) => {
            return (r.kind === ref.kind || ((ref.kind & kindMask) > 0 && (r.kind & kindMask) > 0)) && ref.name === r.name;
        }).map((r) => {
            return vscode_languageserver_types_1.DocumentHighlight.create(r.location.range, vscode_languageserver_types_1.DocumentHighlightKind.Read);
        });
    }
}
exports.HighlightProvider = HighlightProvider;
