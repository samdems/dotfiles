'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const parsedDocument_1 = require("./parsedDocument");
const symbolStore_1 = require("./symbolStore");
const symbolProvider_1 = require("./symbolProvider");
const completionProvider_1 = require("./completionProvider");
const diagnosticsProvider_1 = require("./diagnosticsProvider");
const signatureHelpProvider_1 = require("./signatureHelpProvider");
const definitionProvider_1 = require("./definitionProvider");
const formatProvider_1 = require("./formatProvider");
const commands_1 = require("./commands");
const referenceReader_1 = require("./referenceReader");
const referenceProvider_1 = require("./referenceProvider");
const reference_1 = require("./reference");
const cache_1 = require("./cache");
const logger_1 = require("./logger");
const path = require("path");
const hoverProvider_1 = require("./hoverProvider");
const highlightProvider_1 = require("./highlightProvider");
var Intelephense;
(function (Intelephense) {
    const phpLanguageId = 'php';
    let documentStore;
    let symbolStore;
    let refStore;
    let symbolProvider;
    let completionProvider;
    let diagnosticsProvider;
    let signatureHelpProvider;
    let definitionProvider;
    let formatProvider;
    let nameTextEditProvider;
    let referenceProvider;
    let hoverProvider;
    let highlightProvider;
    let cacheClear = false;
    let symbolCache;
    let refCache;
    let stateCache;
    const stateTimestampKey = 'timestamp';
    const knownDocsFilename = 'known_uris.json';
    const refStoreCacheKey = 'referenceStore';
    let diagnosticsUnsubscribe;
    let cacheTimestamp = 0;
    let storagePath = '';
    function onPublishDiagnostics(fn) {
        if (diagnosticsUnsubscribe) {
            diagnosticsUnsubscribe();
        }
        if (fn) {
            diagnosticsUnsubscribe = diagnosticsProvider.publishDiagnosticsEvent.subscribe(fn);
        }
    }
    Intelephense.onPublishDiagnostics = onPublishDiagnostics;
    function initialise(options) {
        if (options.logWriter) {
            logger_1.Log.writer = options.logWriter;
        }
        storagePath = options.storagePath;
        symbolCache = cache_1.createCache(storagePath ? path.join(storagePath, 'symbols') : undefined);
        refCache = cache_1.createCache(storagePath ? path.join(storagePath, 'references') : undefined);
        stateCache = cache_1.createCache(storagePath ? path.join(storagePath, 'state') : undefined);
        documentStore = new parsedDocument_1.ParsedDocumentStore();
        symbolStore = new symbolStore_1.SymbolStore();
        refStore = new reference_1.ReferenceStore(refCache);
        symbolProvider = new symbolProvider_1.SymbolProvider(symbolStore);
        completionProvider = new completionProvider_1.CompletionProvider(symbolStore, documentStore, refStore);
        diagnosticsProvider = new diagnosticsProvider_1.DiagnosticsProvider();
        signatureHelpProvider = new signatureHelpProvider_1.SignatureHelpProvider(symbolStore, documentStore, refStore);
        definitionProvider = new definitionProvider_1.DefinitionProvider(symbolStore, documentStore, refStore);
        formatProvider = new formatProvider_1.FormatProvider(documentStore);
        nameTextEditProvider = new commands_1.NameTextEditProvider(symbolStore, documentStore, refStore);
        referenceProvider = new referenceProvider_1.ReferenceProvider(documentStore, symbolStore, refStore);
        hoverProvider = new hoverProvider_1.HoverProvider(documentStore, symbolStore, refStore);
        highlightProvider = new highlightProvider_1.HighlightProvider(documentStore, symbolStore, refStore);
        documentStore.parsedDocumentChangeEvent.subscribe((args) => {
            symbolStore.onParsedDocumentChange(args);
            let refTable = referenceReader_1.ReferenceReader.discoverReferences(args.parsedDocument, symbolStore);
            refStore.add(refTable);
        });
        if (options.clearCache) {
            return clearCache().then(() => {
                symbolStore.add(symbolStore_1.SymbolTable.readBuiltInSymbols());
            }).catch((msg) => {
                logger_1.Log.error(msg);
            });
        }
        else if (storagePath) {
            symbolStore.add(symbolStore_1.SymbolTable.readBuiltInSymbols());
            return stateCache.read(stateTimestampKey).then((data) => {
                if (!data) {
                    return;
                }
                cacheTimestamp = data;
            }).then(() => {
                return cache_1.readArrayFromDisk(path.join(storagePath, 'state', knownDocsFilename));
            }).then((uris) => {
                return readCachedSymbolTables(uris);
            }).then(() => {
                return cacheReadReferenceStore();
            }).catch((msg) => {
                logger_1.Log.error(msg);
            });
        }
        else {
            symbolStore.add(symbolStore_1.SymbolTable.readBuiltInSymbols());
            return Promise.resolve();
        }
    }
    Intelephense.initialise = initialise;
    function shutdown() {
        if (!storagePath) {
            return;
        }
        let uris = [];
        for (let t of symbolStore.tables) {
            if (t.uri !== 'php') {
                uris.push(t.uri);
            }
        }
        return stateCache.write(stateTimestampKey, Date.now()).then(() => {
            return cache_1.writeArrayToDisk(uris, path.join(storagePath, 'state', knownDocsFilename)).catch(() => { });
        }).then(() => {
            return refStore.closeAll();
        }).then(() => {
            return cacheWriteReferenceStore();
        }).then(() => {
            return new Promise((resolve, reject) => {
                let openDocs = documentStore.documents;
                let cacheSymbolTableFn = () => {
                    let doc = openDocs.pop();
                    if (doc) {
                        let symbolTable = symbolStore.getSymbolTable(doc.uri);
                        symbolCache.write(doc.uri, symbolTable).then(cacheSymbolTableFn).catch((msg) => {
                            logger_1.Log.error(msg);
                            cacheSymbolTableFn();
                        });
                    }
                    else {
                        resolve();
                    }
                };
                cacheSymbolTableFn();
            });
        }).catch((msg) => {
            logger_1.Log.error(msg);
        });
    }
    Intelephense.shutdown = shutdown;
    const refStoreTableSummariesFileName = 'ref_store_table_summaries.json';
    const refStoreNameIndexFileName = 'ref_store_name_index.json';
    function cacheWriteReferenceStore() {
        let data = refStore.toJSON();
        if (data && data.length > 0) {
            return cache_1.writeArrayToDisk(data, path.join(storagePath, 'state', refStoreTableSummariesFileName)).catch((e) => { });
        }
        else {
            return Promise.resolve();
        }
    }
    function cacheReadReferenceStore() {
        let refStoreTables;
        return cache_1.readArrayFromDisk(path.join(storagePath, 'state', refStoreTableSummariesFileName)).then((items) => {
            if (items && items.length > 0) {
                refStore.fromJSON(items);
            }
        }).catch((err) => {
        });
    }
    function readCachedSymbolTables(keys) {
        if (!keys) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            let count = keys.length;
            if (count < 1) {
                resolve();
            }
            let batch = Math.min(4, count);
            let onCacheReadErr = (msg) => {
                logger_1.Log.error(msg);
                onCacheRead(undefined);
            };
            let onCacheRead = (data) => {
                --count;
                if (data) {
                    symbolStore.add(new symbolStore_1.SymbolTable(data._uri, data._root, data._hash));
                }
                let uri = keys.pop();
                if (uri) {
                    symbolCache.read(uri).then(onCacheRead).catch(onCacheReadErr);
                }
                else if (count < 1) {
                    resolve();
                }
            };
            let uri;
            while (batch-- > 0 && (uri = keys.pop())) {
                symbolCache.read(uri).then(onCacheRead).catch(onCacheReadErr);
            }
        });
    }
    function clearCache() {
        return stateCache.flush().then(() => {
            return refCache.flush();
        }).then(() => {
            return symbolCache.flush();
        }).catch((msg) => {
            logger_1.Log.warn(msg);
        });
    }
    function provideHighlights(uri, position) {
        return highlightProvider.provideHightlights(uri, position);
    }
    Intelephense.provideHighlights = provideHighlights;
    function provideHover(uri, position) {
        return hoverProvider.provideHover(uri, position);
    }
    Intelephense.provideHover = provideHover;
    function knownDocuments() {
        let known = [];
        for (let uri of refStore.knownDocuments()) {
            if (uri !== 'php') {
                known.push(uri);
            }
        }
        return { timestamp: cacheTimestamp, documents: known };
    }
    Intelephense.knownDocuments = knownDocuments;
    function documentLanguageRanges(textDocument) {
        let doc = documentStore.find(textDocument.uri);
        return doc ? { version: doc.version, ranges: doc.documentLanguageRanges() } : undefined;
    }
    Intelephense.documentLanguageRanges = documentLanguageRanges;
    function setConfig(config) {
        diagnosticsProvider.debounceWait = config.diagnosticsProvider.debounce;
        diagnosticsProvider.maxItems = config.diagnosticsProvider.maxItems;
        completionProvider.config = config.completionProvider;
    }
    Intelephense.setConfig = setConfig;
    function openDocument(textDocument) {
        if (textDocument.languageId !== phpLanguageId || documentStore.has(textDocument.uri)) {
            return;
        }
        let parsedDocument = new parsedDocument_1.ParsedDocument(textDocument.uri, textDocument.text, textDocument.version);
        documentStore.add(parsedDocument);
        let symbolTable = symbolStore_1.SymbolTable.create(parsedDocument);
        symbolStore.add(symbolTable);
        let refTable = referenceReader_1.ReferenceReader.discoverReferences(parsedDocument, symbolStore);
        refStore.add(refTable);
        diagnosticsProvider.add(parsedDocument);
    }
    Intelephense.openDocument = openDocument;
    function closeDocument(textDocument) {
        documentStore.remove(textDocument.uri);
        refStore.close(textDocument.uri);
        diagnosticsProvider.remove(textDocument.uri);
        let symbolTable = symbolStore.getSymbolTable(textDocument.uri);
        if (symbolTable) {
            symbolTable.pruneScopedVars();
            return symbolCache.write(symbolTable.uri, symbolTable).catch((msg) => { logger_1.Log.error(msg); });
        }
    }
    Intelephense.closeDocument = closeDocument;
    function editDocument(textDocument, contentChanges) {
        let parsedDocument = documentStore.find(textDocument.uri);
        if (parsedDocument) {
            parsedDocument.version = textDocument.version;
            parsedDocument.applyChanges(contentChanges);
        }
    }
    Intelephense.editDocument = editDocument;
    function documentSymbols(textDocument) {
        flushParseDebounce(textDocument.uri);
        return symbolProvider.provideDocumentSymbols(textDocument.uri);
    }
    Intelephense.documentSymbols = documentSymbols;
    function workspaceSymbols(query) {
        return query ? symbolProvider.provideWorkspaceSymbols(query) : [];
    }
    Intelephense.workspaceSymbols = workspaceSymbols;
    function provideCompletions(textDocument, position) {
        flushParseDebounce(textDocument.uri);
        return completionProvider.provideCompletions(textDocument.uri, position);
    }
    Intelephense.provideCompletions = provideCompletions;
    function provideSignatureHelp(textDocument, position) {
        flushParseDebounce(textDocument.uri);
        return signatureHelpProvider.provideSignatureHelp(textDocument.uri, position);
    }
    Intelephense.provideSignatureHelp = provideSignatureHelp;
    function provideDefinition(textDocument, position) {
        flushParseDebounce(textDocument.uri);
        return definitionProvider.provideDefinition(textDocument.uri, position);
    }
    Intelephense.provideDefinition = provideDefinition;
    function discoverSymbols(textDocument) {
        let uri = textDocument.uri;
        if (documentStore.has(uri)) {
            let symbolTable = symbolStore.getSymbolTable(uri);
            return symbolTable ? symbolTable.symbolCount : 0;
        }
        let text = textDocument.text;
        let parsedDocument = new parsedDocument_1.ParsedDocument(uri, text, textDocument.version);
        let symbolTable = symbolStore_1.SymbolTable.create(parsedDocument, true);
        symbolTable.pruneScopedVars();
        symbolStore.add(symbolTable);
        return symbolCache.write(symbolTable.uri, symbolTable).then(() => {
            return symbolTable.symbolCount;
        }).catch((msg) => {
            logger_1.Log.warn(msg);
            return symbolTable.symbolCount;
        });
    }
    Intelephense.discoverSymbols = discoverSymbols;
    function discoverReferences(textDocument) {
        let uri = textDocument.uri;
        let refTable = refStore.getReferenceTable(uri);
        if (documentStore.has(uri)) {
            return refTable ? refTable.referenceCount : 0;
        }
        if (!symbolStore.getSymbolTable(uri)) {
            return 0;
        }
        let text = textDocument.text;
        let parsedDocument = new parsedDocument_1.ParsedDocument(uri, text, textDocument.version);
        refTable = referenceReader_1.ReferenceReader.discoverReferences(parsedDocument, symbolStore);
        refStore.add(refTable);
        refStore.close(refTable.uri);
        return refTable.referenceCount;
    }
    Intelephense.discoverReferences = discoverReferences;
    function forget(uri) {
        symbolStore.remove(uri);
        refStore.remove(uri, true);
    }
    Intelephense.forget = forget;
    function provideContractFqnTextEdits(uri, position, alias) {
        flushParseDebounce(uri);
        return nameTextEditProvider.provideContractFqnTextEdits(uri, position, alias);
    }
    Intelephense.provideContractFqnTextEdits = provideContractFqnTextEdits;
    function numberDocumentsOpen() {
        return documentStore.count;
    }
    Intelephense.numberDocumentsOpen = numberDocumentsOpen;
    function numberDocumentsKnown() {
        return symbolStore.tableCount;
    }
    Intelephense.numberDocumentsKnown = numberDocumentsKnown;
    function numberSymbolsKnown() {
        return symbolStore.symbolCount;
    }
    Intelephense.numberSymbolsKnown = numberSymbolsKnown;
    function provideDocumentFormattingEdits(doc, formatOptions) {
        flushParseDebounce(doc.uri);
        return formatProvider.provideDocumentFormattingEdits(doc, formatOptions);
    }
    Intelephense.provideDocumentFormattingEdits = provideDocumentFormattingEdits;
    function provideDocumentRangeFormattingEdits(doc, range, formatOptions) {
        flushParseDebounce(doc.uri);
        return formatProvider.provideDocumentRangeFormattingEdits(doc, range, formatOptions);
    }
    Intelephense.provideDocumentRangeFormattingEdits = provideDocumentRangeFormattingEdits;
    function provideReferences(doc, pos, context) {
        flushParseDebounce(doc.uri);
        return referenceProvider.provideReferenceLocations(doc.uri, pos, context);
    }
    Intelephense.provideReferences = provideReferences;
    function flushParseDebounce(uri) {
        let parsedDocument = documentStore.find(uri);
        if (parsedDocument) {
            parsedDocument.flush();
        }
    }
})(Intelephense = exports.Intelephense || (exports.Intelephense = {}));
