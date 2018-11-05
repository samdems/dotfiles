'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const php7parser_1 = require("php7parser");
const textDocument_1 = require("./textDocument");
const lsp = require("vscode-languageserver-types");
const types_1 = require("./types");
const util = require("./util");
const textDocumentChangeDebounceWait = 250;
class ParsedDocument {
    constructor(uri, text, version = 0) {
        this.version = version;
        this._uriHash = 0;
        this._reparse = (x) => {
            this._parseTree = php7parser_1.Parser.parse(this._textDocument.text);
            this._changeEvent.trigger({ parsedDocument: this });
        };
        this._parseTree = php7parser_1.Parser.parse(text);
        this._textDocument = new textDocument_1.TextDocument(uri, text);
        this._debounce = new types_1.Debounce(this._reparse, textDocumentChangeDebounceWait);
        this._changeEvent = new types_1.Event();
        this._uriHash = Math.abs(util.hash32(uri));
    }
    get tree() {
        return this._parseTree;
    }
    get uri() {
        return this._textDocument.uri;
    }
    get text() {
        return this._textDocument.text;
    }
    get changeEvent() {
        return this._changeEvent;
    }
    find(predicate) {
        let traverser = new types_1.TreeTraverser([this._parseTree]);
        return traverser.find(predicate);
    }
    textBeforeOffset(offset, length) {
        return this._textDocument.textBeforeOffset(offset, length);
    }
    lineSubstring(offset) {
        return this._textDocument.lineSubstring(offset);
    }
    wordAtOffset(offset) {
        let lineText = this._textDocument.lineSubstring(offset);
        let match = lineText.match(ParsedDocument._wordRegex);
        return match ? match[0] : '';
    }
    flush() {
        this._debounce.flush();
    }
    traverse(visitor) {
        let traverser = new types_1.TreeTraverser([this._parseTree]);
        traverser.traverse(visitor);
        return visitor;
    }
    applyChanges(contentChanges) {
        let change;
        for (let n = 0, l = contentChanges.length; n < l; ++n) {
            change = contentChanges[n];
            if (!change.range) {
                this._textDocument.text = change.text;
            }
            else {
                this._textDocument.applyEdit(change.range.start, change.range.end, change.text);
            }
        }
        this._debounce.handle(null);
    }
    tokenRange(t) {
        if (!t) {
            return null;
        }
        let r = {
            start: this._textDocument.positionAtOffset(t.offset),
            end: this._textDocument.positionAtOffset(t.offset + t.length)
        };
        return r;
    }
    nodeHashedLocation(node) {
        if (!node) {
            return null;
        }
        let range = this.nodeRange(node);
        if (!range) {
            return null;
        }
        return types_1.HashedLocation.create(this._uriHash, range);
    }
    nodeLocation(node) {
        if (!node) {
            return undefined;
        }
        let range = this.nodeRange(node);
        if (!range) {
            return undefined;
        }
        return lsp.Location.create(this.uri, range);
    }
    nodeRange(node) {
        if (!node) {
            return null;
        }
        if (ParsedDocument.isToken(node)) {
            return this.tokenRange(node);
        }
        let tFirst = ParsedDocument.firstToken(node);
        let tLast = ParsedDocument.lastToken(node);
        if (!tFirst || !tLast) {
            return lsp.Range.create(0, 0, 0, 0);
        }
        let range = {
            start: this._textDocument.positionAtOffset(tFirst.offset),
            end: this._textDocument.positionAtOffset(tLast.offset + tLast.length)
        };
        return range;
    }
    tokenText(t) {
        return t && t.tokenType !== undefined ? this._textDocument.textAtOffset(t.offset, t.length) : '';
    }
    nodeText(node) {
        if (!node) {
            return '';
        }
        if (node.tokenType !== undefined) {
            return this._textDocument.textAtOffset(node.offset, node.length);
        }
        let tFirst = ParsedDocument.firstToken(node);
        let tLast = ParsedDocument.lastToken(node);
        if (!tFirst || !tLast) {
            return '';
        }
        return this._textDocument.text.slice(tFirst.offset, tLast.offset + tLast.length);
    }
    createAnonymousName(node) {
        let tFirst = ParsedDocument.firstToken(node);
        let offset = tFirst ? tFirst.offset : 0;
        return `#anon#${this.uri}#${offset}`;
    }
    positionAtOffset(offset) {
        return this._textDocument.positionAtOffset(offset);
    }
    offsetAtPosition(position) {
        return this._textDocument.offsetAtPosition(position);
    }
    documentLanguageRanges() {
        let visitor = new DocumentLanguageRangesVisitor(this);
        this.traverse(visitor);
        return visitor.ranges;
    }
}
ParsedDocument._wordRegex = /[$a-zA-Z_\x80-\xff][\\a-zA-Z0-9_\x80-\xff]*$/;
exports.ParsedDocument = ParsedDocument;
(function (ParsedDocument) {
    function firstToken(node) {
        if (ParsedDocument.isToken(node)) {
            return node;
        }
        let t;
        for (let n = 0, l = node.children.length; n < l; ++n) {
            t = this.firstToken(node.children[n]);
            if (t !== null) {
                return t;
            }
        }
        return null;
    }
    ParsedDocument.firstToken = firstToken;
    function lastToken(node) {
        if (ParsedDocument.isToken(node)) {
            return node;
        }
        let t;
        for (let n = node.children.length - 1; n >= 0; --n) {
            t = this.lastToken(node.children[n]);
            if (t !== null) {
                return t;
            }
        }
        return null;
    }
    ParsedDocument.lastToken = lastToken;
    function isToken(node, types) {
        return node && node.tokenType !== undefined &&
            (!types || types.indexOf(node.tokenType) > -1);
    }
    ParsedDocument.isToken = isToken;
    function isPhrase(node, types) {
        return node && node.phraseType !== undefined &&
            (!types || types.indexOf(node.phraseType) > -1);
    }
    ParsedDocument.isPhrase = isPhrase;
    function isOffsetInToken(offset, t) {
        return offset > -1 && ParsedDocument.isToken(t) &&
            t.offset <= offset &&
            t.offset + t.length - 1 >= offset;
    }
    ParsedDocument.isOffsetInToken = isOffsetInToken;
    function isOffsetInNode(offset, node) {
        if (!node || offset < 0) {
            return false;
        }
        if (ParsedDocument.isToken(node)) {
            return ParsedDocument.isOffsetInToken(offset, node);
        }
        let tFirst = ParsedDocument.firstToken(node);
        let tLast = ParsedDocument.lastToken(node);
        if (!tFirst || !tLast) {
            return false;
        }
        return tFirst.offset <= offset && tLast.offset + tLast.length - 1 >= offset;
    }
    ParsedDocument.isOffsetInNode = isOffsetInNode;
    function findChild(parent, fn) {
        if (!parent || !parent.children) {
            return undefined;
        }
        let child;
        for (let n = 0, l = parent.children.length; n < l; ++n) {
            child = parent.children[n];
            if (fn(child)) {
                return child;
            }
        }
        return undefined;
    }
    ParsedDocument.findChild = findChild;
    function filterChildren(parent, fn) {
        let filtered = [];
        if (!parent || !parent.children) {
            return filtered;
        }
        let child;
        for (let n = 0, l = parent.children.length; n < l; ++n) {
            child = parent.children[n];
            if (fn(child)) {
                filtered.push(child);
            }
        }
        return filtered;
    }
    ParsedDocument.filterChildren = filterChildren;
    function isNamePhrase(node) {
        if (!node) {
            return false;
        }
        switch (node.phraseType) {
            case 141:
            case 144:
            case 84:
                return true;
            default:
                return false;
        }
    }
    ParsedDocument.isNamePhrase = isNamePhrase;
})(ParsedDocument = exports.ParsedDocument || (exports.ParsedDocument = {}));
class ParsedDocumentStore {
    constructor() {
        this._bubbleEvent = (args) => {
            this._parsedDocumentChangeEvent.trigger(args);
        };
        this._parsedDocumentmap = {};
        this._parsedDocumentChangeEvent = new types_1.Event();
        this._unsubscribeMap = {};
    }
    get parsedDocumentChangeEvent() {
        return this._parsedDocumentChangeEvent;
    }
    get count() {
        return Object.keys(this._parsedDocumentmap).length;
    }
    get documents() {
        return Object.keys(this._parsedDocumentmap).map((v) => {
            return this._parsedDocumentmap[v];
        });
    }
    has(uri) {
        return this._parsedDocumentmap[uri] !== undefined;
    }
    add(parsedDocument) {
        if (this.has(parsedDocument.uri)) {
            throw new Error('Duplicate key');
        }
        this._parsedDocumentmap[parsedDocument.uri] = parsedDocument;
        this._unsubscribeMap[parsedDocument.uri] = parsedDocument.changeEvent.subscribe(this._bubbleEvent);
    }
    remove(uri) {
        if (!this.has(uri)) {
            return;
        }
        let unsubscribe = this._unsubscribeMap[uri];
        unsubscribe();
        delete this._parsedDocumentmap[uri];
    }
    find(uri) {
        return this._parsedDocumentmap[uri];
    }
}
exports.ParsedDocumentStore = ParsedDocumentStore;
class ToStringVisitor {
    constructor(doc, ignore) {
        this._text = '';
        this._doc = doc;
    }
    get text() {
        return this._text;
    }
    postorder(node, spine) {
        if (ParsedDocument.isToken(node) && (!this._ignore || this._ignore.indexOf(node.tokenType) < 0)) {
            this._text += this._doc.tokenText(node);
        }
    }
}
const phpLanguageId = 'php';
class DocumentLanguageRangesVisitor {
    constructor(doc) {
        this.doc = doc;
        this._ranges = [];
    }
    get ranges() {
        if (this._phpOpenPosition && this._lastToken) {
            this._ranges.push({
                range: lsp.Range.create(this._phpOpenPosition, this.doc.tokenRange(this._lastToken).end),
                languageId: phpLanguageId
            });
            this._phpOpenPosition = undefined;
        }
        return this._ranges;
    }
    preorder(node, spine) {
        switch (node.tokenType) {
            case 81:
                this._ranges.push({ range: this.doc.tokenRange(node) });
                break;
            case 156:
            case 157:
                this._phpOpenPosition = this.doc.tokenRange(node).start;
                break;
            case 158:
                {
                    let closeTagRange = this.doc.tokenRange(node);
                    this._ranges.push({
                        range: lsp.Range.create(this._phpOpenPosition || closeTagRange.start, closeTagRange.end),
                        languageId: phpLanguageId
                    });
                    this._phpOpenPosition = undefined;
                }
                break;
            default:
                break;
        }
        if (node.tokenType !== undefined) {
            this._lastToken = node;
        }
        return true;
    }
}
