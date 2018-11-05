'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./types");
const php7parser_1 = require("php7parser");
const lsp = require("vscode-languageserver-types");
class DiagnosticsProvider {
    constructor() {
        this._onParsedDocumentChanged = (args) => {
            this._startDiagnostics.trigger(args.parsedDocument.uri);
            let diagnostics = this._diagnose(args.parsedDocument.uri);
            this._publish.trigger({ uri: args.parsedDocument.uri, diagnostics: diagnostics });
        };
        this._debounceWaitTime = 1000;
        this._docs = {};
        this._publish = new types_1.Event();
        this._startDiagnostics = new types_1.Event();
        this._debounceMap = {};
        this._unsubscribeMap = {};
        this.maxItems = 100;
    }
    get startDiagnosticsEvent() {
        return this._startDiagnostics;
    }
    get publishDiagnosticsEvent() {
        return this._publish;
    }
    add(doc) {
        if (this.has(doc.uri)) {
            throw new Error('Duplicate Key');
        }
        this._docs[doc.uri] = doc;
        let dd = this._debounceMap[doc.uri] = new types_1.Debounce(this._onParsedDocumentChanged, this._debounceWaitTime);
        this._unsubscribeMap[doc.uri] = doc.changeEvent.subscribe((x) => {
            dd.handle(x);
        });
    }
    remove(uri) {
        if (!this.has(uri)) {
            return;
        }
        this._unsubscribeMap[uri]();
        this._debounceMap[uri].clear();
        delete this._debounceMap[uri];
        delete this._unsubscribeMap[uri];
        delete this._docs[uri];
    }
    has(uri) {
        return this._docs[uri] !== undefined;
    }
    set debounceWait(value) {
        this._debounceWaitTime = value;
        let keys = Object.keys(this._debounceMap);
        for (let n = 0, l = keys.length; n < l; ++n) {
            this._debounceMap[keys[n]].wait = this._debounceWaitTime;
        }
    }
    _diagnose(uri) {
        let diagnostics = [];
        let parseErrorVisitor = new ErrorVisitor();
        let doc = this._docs[uri];
        if (!doc) {
            return [];
        }
        doc.traverse(parseErrorVisitor);
        let parseErrors = parseErrorVisitor.errors;
        for (let n = 0, l = parseErrors.length; n < l; ++n) {
            diagnostics.push(this._parseErrorToDiagnostic(parseErrors[n], doc));
        }
        return diagnostics.slice(0, this._maxItems);
    }
    _parseErrorToDiagnostic(err, doc) {
        return lsp.Diagnostic.create(this._errorRange(err, doc), this._message(err), lsp.DiagnosticSeverity.Error, undefined, 'intelephense');
    }
    _message(err) {
        let msg = `Unexpected ${php7parser_1.tokenTypeToString(err.unexpected.tokenType)}.`;
        if (err.expected) {
            msg += ` Expected ${php7parser_1.tokenTypeToString(err.expected)}.`;
        }
        return msg;
    }
    _errorRange(err, doc) {
        if (!err.children || err.children.length < 1) {
            return doc.tokenRange(err.unexpected);
        }
        let tFirst = err.children[0];
        let tLast = err.children[err.children.length - 1];
        return lsp.Range.create(doc.tokenRange(tFirst).start, doc.tokenRange(tLast).end);
    }
}
exports.DiagnosticsProvider = DiagnosticsProvider;
class ErrorVisitor {
    constructor() {
        this._errors = [];
    }
    get errors() {
        return this._errors;
    }
    preorder(node, spine) {
        if (node.phraseType === 60) {
            this._errors.push(node);
            return false;
        }
        return true;
    }
}
