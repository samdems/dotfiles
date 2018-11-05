'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
const parseTreeTraverser_1 = require("./parseTreeTraverser");
const symbol_1 = require("./symbol");
const useDeclarationHelper_1 = require("./useDeclarationHelper");
const util = require("./util");
class NameTextEditProvider {
    constructor(symbolStore, docStore, refStore) {
        this.symbolStore = symbolStore;
        this.docStore = docStore;
        this.refStore = refStore;
    }
    provideContractFqnTextEdits(uri, position, alias) {
        const kindMask = 1 | 2 | 4 | 64 | 8 | 2048;
        let edits = [];
        let doc = this.docStore.find(uri);
        let table = this.symbolStore.getSymbolTable(uri);
        let refTable = this.refStore.getReferenceTable(uri);
        if (!doc || !table || !refTable || !this._fullyQualifiedNamePhrase(position, doc, table, refTable)) {
            return edits;
        }
        let ref = refTable.referenceAtPosition(position);
        if (!(ref.kind & kindMask)) {
            return edits;
        }
        let helper = new useDeclarationHelper_1.UseDeclarationHelper(doc, table, position);
        let fqnUseSymbol = helper.findUseSymbolByFqn(ref.name);
        let nameUseSymbol = helper.findUseSymbolByName(symbol_1.PhpSymbol.notFqn(ref.name));
        if (!fqnUseSymbol) {
            if (!alias && nameUseSymbol) {
                return edits;
            }
            edits.push(helper.insertDeclarationTextEdit(ref, alias));
        }
        else if (alias && fqnUseSymbol.name !== alias) {
            edits.push(helper.replaceDeclarationTextEdit(ref, alias));
        }
        let name = alias || symbol_1.PhpSymbol.notFqn(ref.name);
        let lcName = ref.name.toLowerCase();
        let fn = (r) => {
            return (r.kind & kindMask) > 0 &&
                lcName === r.name.toLowerCase() &&
                (!fqnUseSymbol ||
                    (util.isInRange(r.location.range.start, fqnUseSymbol.location.range) !== 0 &&
                        util.isInRange(r.location.range.end, fqnUseSymbol.location.range) !== 0));
        };
        let references = refTable.references(fn);
        for (let n = 0, l = references.length; n < l; ++n) {
            edits.push(vscode_languageserver_types_1.TextEdit.replace(references[n].location.range, name));
        }
        return edits.reverse();
    }
    _fullyQualifiedNamePhrase(position, doc, table, refTable) {
        let traverser = new parseTreeTraverser_1.ParseTreeTraverser(doc, table, refTable);
        traverser.position(position);
        return traverser.ancestor(this._isFullyQualifiedName);
    }
    _isFullyQualifiedName(node) {
        return node.phraseType === 84;
    }
}
exports.NameTextEditProvider = NameTextEditProvider;
