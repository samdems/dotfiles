'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const parsedDocument_1 = require("./parsedDocument");
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
const util = require("./util");
class UseDeclarationHelper {
    constructor(doc, table, cursor) {
        this.doc = doc;
        this.table = table;
        this._useDeclarations = table.filter(this._isUseDeclarationSymbol);
        this._cursor = cursor;
    }
    insertDeclarationTextEdit(symbol, alias) {
        let afterNode = this._insertAfterNode();
        let text = '\n';
        if (afterNode.phraseType === 120) {
            text += '\n';
        }
        text += util.whitespace(this._insertAfterNodeRange().start.character);
        text += 'use ';
        switch (symbol.kind) {
            case 8:
                text += 'const ';
                break;
            case 64:
                text += 'function ';
                break;
            default:
                break;
        }
        text += symbol.name;
        if (alias) {
            text += ' as ' + alias;
        }
        text += ';';
        if (afterNode.phraseType !== 124) {
            text += '\n';
        }
        return vscode_languageserver_types_1.TextEdit.insert(this._insertPosition(), text);
    }
    replaceDeclarationTextEdit(symbol, alias) {
        let useSymbol = this.findUseSymbolByFqn(symbol.name);
        let node = this.findNamespaceUseClauseByRange(useSymbol.location.range);
        let aliasingClause = parsedDocument_1.ParsedDocument.findChild(node, this._isNamespaceAliasingClause);
        if (aliasingClause) {
            return vscode_languageserver_types_1.TextEdit.replace(this.doc.nodeRange(aliasingClause), `as ${alias}`);
        }
        else {
            return vscode_languageserver_types_1.TextEdit.insert(this.doc.nodeRange(node).end, ` as ${alias}`);
        }
    }
    deleteDeclarationTextEdit(fqn) {
    }
    findUseSymbolByFqn(fqn) {
        let lcFqn = fqn.toLowerCase();
        let fn = (x) => {
            return x.associated && x.associated.length > 0 && x.associated[0].name.toLowerCase() === lcFqn;
        };
        return this._useDeclarations.find(fn);
    }
    findUseSymbolByName(name) {
        let lcName = name.toLowerCase();
        let fn = (x) => {
            return x.name.toLowerCase() === lcName;
        };
        return this._useDeclarations.find(fn);
    }
    findNamespaceUseClauseByRange(range) {
        let fn = (x) => {
            return (x.phraseType === 122 || x.phraseType === 125) &&
                util.rangeEquality(range, this.doc.nodeRange(x));
        };
        return this.doc.find(fn);
    }
    _isUseDeclarationSymbol(s) {
        const mask = 1 | 64 | 8;
        return (s.modifiers & 4096) > 0 && (s.kind & mask) > 0;
    }
    _insertAfterNode() {
        if (this._afterNode) {
            return this._afterNode;
        }
        let visitor = new InsertAfterNodeVisitor(this.doc, this.doc.offsetAtPosition(this._cursor));
        this.doc.traverse(visitor);
        return this._afterNode = visitor.lastNamespaceUseDeclaration || visitor.namespaceDefinition || visitor.openingInlineText;
    }
    _insertAfterNodeRange() {
        if (this._afterNodeRange) {
            return this._afterNodeRange;
        }
        return this._afterNodeRange = this.doc.nodeRange(this._insertAfterNode());
    }
    _insertPosition() {
        return this._insertAfterNodeRange().end;
    }
    _isNamespaceAliasingClause(node) {
        return node.phraseType === 119;
    }
}
exports.UseDeclarationHelper = UseDeclarationHelper;
class InsertAfterNodeVisitor {
    constructor(document, offset) {
        this.document = document;
        this.haltTraverse = false;
        this.haltAtOffset = -1;
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
    preorder(node, spine) {
        switch (node.phraseType) {
            case 99:
                if (!this._openingInlineText) {
                    this._openingInlineText = node;
                }
                break;
            case 120:
                if (!parsedDocument_1.ParsedDocument.findChild(node, this._isStatementList)) {
                    this._namespaceDefinition = node;
                }
                break;
            case 124:
                this._lastNamespaceUseDeclaration = node;
                break;
            case undefined:
                if (this.haltAtOffset > -1 && parsedDocument_1.ParsedDocument.isOffsetInToken(this.haltAtOffset, node)) {
                    this.haltTraverse = true;
                    return false;
                }
                break;
            default:
                break;
        }
        return true;
    }
    _isStatementList(node) {
        return node.phraseType === 157;
    }
}
