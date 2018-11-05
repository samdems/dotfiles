'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const symbol_1 = require("./symbol");
class HoverProvider {
    constructor(docStore, symbolStore, refStore) {
        this.docStore = docStore;
        this.symbolStore = symbolStore;
        this.refStore = refStore;
    }
    provideHover(uri, pos) {
        let doc = this.docStore.find(uri);
        let table = this.refStore.getReferenceTable(uri);
        if (!doc || !table) {
            return undefined;
        }
        let ref = table.referenceAtPosition(pos);
        if (!ref) {
            return undefined;
        }
        let symbol = this.symbolStore.findSymbolsByReference(ref, 1).shift();
        if (!symbol) {
            return undefined;
        }
        switch (symbol.kind) {
            case 64:
            case 32:
                return {
                    contents: [this.modifiersToString(symbol.modifiers), symbol.name + symbol_1.PhpSymbol.signatureString(symbol)].join(' ').trim(),
                    range: ref.location.range
                };
            case 128:
                return {
                    contents: [symbol_1.PhpSymbol.type(symbol) || 'mixed', symbol.name].join(' ').trim(),
                    range: ref.location.range
                };
            case 16:
                return {
                    contents: [this.modifiersToString(symbol.modifiers), symbol_1.PhpSymbol.type(symbol) || 'mixed', symbol.name].join(' ').trim(),
                    range: ref.location.range
                };
            case 256:
                return {
                    contents: [ref.type, symbol.name].join(' ').trim(),
                    range: ref.location.range
                };
            case 8:
            case 1024:
                return {
                    contents: [this.modifiersToString(symbol.modifiers), 'const', symbol.name, symbol.value ? `= ${symbol.value}` : ''].join(' ').trim(),
                    range: ref.location.range
                };
            default:
                return undefined;
        }
    }
    modifiersToString(modifiers) {
        let modStrings = [];
        if (modifiers & 1) {
            modStrings.push('public');
        }
        if (modifiers & 2) {
            modStrings.push('protected');
        }
        if (modifiers & 4) {
            modStrings.push('private');
        }
        if (modifiers & 8) {
            modStrings.push('final');
        }
        if (modifiers & 16) {
            modStrings.push('abstract');
        }
        return modStrings.join(' ');
    }
}
exports.HoverProvider = HoverProvider;
