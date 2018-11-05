/* Copyright (c) Ben Robert Mewburn
 * Licensed under the ISC Licence.
 */

'use strict';

import { ParsedDocument, ParsedDocumentStore, ParsedDocumentChangeEventArgs, LanguageRange } from './parsedDocument';
import { SymbolStore, SymbolTable } from './symbolStore';
import { SymbolProvider } from './symbolProvider';
import { CompletionProvider, CompletionOptions } from './completionProvider';
import { DiagnosticsProvider, PublishDiagnosticsEventArgs } from './diagnosticsProvider';
import { Debounce, Unsubscribe } from './types';
import { SignatureHelpProvider } from './signatureHelpProvider';
import { DefinitionProvider } from './definitionProvider';
import { PhraseType } from 'php7parser';
import { FormatProvider } from './formatProvider';
import * as lsp from 'vscode-languageserver-types';
import { NameTextEditProvider } from './commands';
import { ReferenceReader } from './referenceReader';
import { NameResolver } from './nameResolver';
import { ReferenceProvider } from './referenceProvider';
import { ReferenceStore } from './reference';
import { createCache, Cache, writeArrayToDisk, readArrayFromDisk } from './cache';
import { Log, LogWriter } from './logger';
import * as path from 'path';
export { LanguageRange } from './parsedDocument';
import { HoverProvider } from './hoverProvider';
import { HighlightProvider } from './highlightProvider';


export namespace Intelephense {

    const phpLanguageId = 'php';

    let documentStore: ParsedDocumentStore;
    let symbolStore: SymbolStore;
    let refStore: ReferenceStore;
    let symbolProvider: SymbolProvider;
    let completionProvider: CompletionProvider;
    let diagnosticsProvider: DiagnosticsProvider;
    let signatureHelpProvider: SignatureHelpProvider;
    let definitionProvider: DefinitionProvider;
    let formatProvider: FormatProvider;
    let nameTextEditProvider: NameTextEditProvider;
    let referenceProvider: ReferenceProvider;
    let hoverProvider: HoverProvider;
    let highlightProvider: HighlightProvider;
    let cacheClear = false;
    let symbolCache: Cache;
    let refCache: Cache;
    let stateCache: Cache;
    const stateTimestampKey = 'timestamp';
    const knownDocsFilename = 'known_uris.json';
    const refStoreCacheKey = 'referenceStore';

    let diagnosticsUnsubscribe: Unsubscribe;

    let cacheTimestamp = 0;
    let storagePath = '';

    export function onPublishDiagnostics(fn: (args: PublishDiagnosticsEventArgs) => void) {
        if (diagnosticsUnsubscribe) {
            diagnosticsUnsubscribe();
        }

        if (fn) {
            diagnosticsUnsubscribe = diagnosticsProvider.publishDiagnosticsEvent.subscribe(fn);
        }
    }

    export function initialise(options: InitialisationOptions) {

        if (options.logWriter) {
            Log.writer = options.logWriter;
        }
        storagePath = options.storagePath;
        symbolCache = createCache(storagePath ? path.join(storagePath, 'symbols') : undefined);
        refCache = createCache(storagePath ? path.join(storagePath, 'references'): undefined);
        stateCache = createCache(storagePath ? path.join(storagePath, 'state'): undefined);
        documentStore = new ParsedDocumentStore();
        symbolStore = new SymbolStore();
        refStore = new ReferenceStore(refCache);
        symbolProvider = new SymbolProvider(symbolStore);
        completionProvider = new CompletionProvider(symbolStore, documentStore, refStore);
        diagnosticsProvider = new DiagnosticsProvider();
        signatureHelpProvider = new SignatureHelpProvider(symbolStore, documentStore, refStore);
        definitionProvider = new DefinitionProvider(symbolStore, documentStore, refStore);
        formatProvider = new FormatProvider(documentStore);
        nameTextEditProvider = new NameTextEditProvider(symbolStore, documentStore, refStore);
        referenceProvider = new ReferenceProvider(documentStore, symbolStore, refStore);
        hoverProvider = new HoverProvider(documentStore, symbolStore, refStore);
        highlightProvider = new HighlightProvider(documentStore, symbolStore, refStore);

        //keep stores in sync
        documentStore.parsedDocumentChangeEvent.subscribe((args) => {
            symbolStore.onParsedDocumentChange(args);
            let refTable = ReferenceReader.discoverReferences(args.parsedDocument, symbolStore);
            refStore.add(refTable);
        });

        if (options.clearCache) {
            return clearCache().then(() => {
                symbolStore.add(SymbolTable.readBuiltInSymbols());
            }).catch((msg) => {
                Log.error(msg);
            });
        } else if(storagePath) {
            symbolStore.add(SymbolTable.readBuiltInSymbols());
            return stateCache.read(stateTimestampKey).then((data) => {
                if (!data) {
                    return;
                }
                cacheTimestamp = data;
                
            }).then(()=>{
                return readArrayFromDisk(path.join(storagePath, 'state', knownDocsFilename));
            }).then((uris)=>{
                return readCachedSymbolTables(uris);
            }).then(() => {
                return cacheReadReferenceStore();
            }).catch((msg) => {
                Log.error(msg);
            });
        } else {
            symbolStore.add(SymbolTable.readBuiltInSymbols());
            return Promise.resolve();
        }

    }

    export function shutdown() {

        if(!storagePath) {
            return;
        }

        let uris: string[] = [];
        for (let t of symbolStore.tables) {
            if (t.uri !== 'php') {
                uris.push(t.uri);
            }
        }
        return stateCache.write(stateTimestampKey, Date.now()).then(() => {
            return writeArrayToDisk(uris, path.join(storagePath, 'state', knownDocsFilename)).catch(()=>{});
        }).then(()=>{
            return refStore.closeAll();
        }).then(() => {
            return cacheWriteReferenceStore();
        }).then(() => {
            return new Promise<void>((resolve, reject) => {
                let openDocs = documentStore.documents;
                let cacheSymbolTableFn = () => {
                    let doc = openDocs.pop();
                    if (doc) {
                        let symbolTable = symbolStore.getSymbolTable(doc.uri);
                        symbolCache.write(doc.uri, symbolTable).then(cacheSymbolTableFn).catch((msg) => {
                            Log.error(msg);
                            cacheSymbolTableFn();
                        });
                    } else {
                        resolve();
                    }
                }
                cacheSymbolTableFn();
            });
        }).catch((msg) => {
            Log.error(msg);
        });

    }

    const refStoreTableSummariesFileName = 'ref_store_table_summaries.json';
    const refStoreNameIndexFileName = 'ref_store_name_index.json';

    function cacheWriteReferenceStore() {
        let data = refStore.toJSON();

        if (data && data.length > 0) {
            return writeArrayToDisk(data, path.join(storagePath, 'state', refStoreTableSummariesFileName)).catch((e)=>{});
        } else {
            return Promise.resolve();
        }

    }

    function cacheReadReferenceStore() {

        let refStoreTables:any[];

        return readArrayFromDisk(path.join(storagePath, 'state', refStoreTableSummariesFileName)).then((items) => {
            if(items && items.length > 0) {
                refStore.fromJSON(items);
            }
        }).catch((err)=>{

        });

    }

    function readCachedSymbolTables(keys: string[]) {

        if (!keys) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve, reject) => {

            let count = keys.length;
            if (count < 1) {
                resolve();
            }

            let batch = Math.min(4, count);
            let onCacheReadErr = (msg: string) => {
                Log.error(msg);
                onCacheRead(undefined);
            }
            let onCacheRead = (data: any) => {
                --count;
                if (data) {
                    symbolStore.add(new SymbolTable(data._uri, data._root, data._hash));
                }

                let uri = keys.pop();
                if (uri) {
                    symbolCache.read(uri).then(onCacheRead).catch(onCacheReadErr);
                } else if (count < 1) {
                    resolve();
                }
            }

            let uri: string;
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
            Log.warn(msg);
        });
    }

    export function provideHighlights(uri: string, position: lsp.Position) {
        return highlightProvider.provideHightlights(uri, position);
    }

    export function provideHover(uri: string, position: lsp.Position) {
        return hoverProvider.provideHover(uri, position);
    }

    export function knownDocuments() {

        //use ref uris because refs are determined last and may have been interrupted
        let known:string[] = [];
        for (let uri of refStore.knownDocuments()) {
            if (uri !== 'php') {
                known.push(uri);
            }
        }

        return { timestamp: cacheTimestamp, documents: known };
    }

    export function documentLanguageRanges(textDocument: lsp.TextDocumentIdentifier): LanguageRangeList {
        let doc = documentStore.find(textDocument.uri);
        return doc ? { version: doc.version, ranges: doc.documentLanguageRanges() } : undefined;
    }

    export function setConfig(config: IntelephenseConfig) {
        diagnosticsProvider.debounceWait = config.diagnosticsProvider.debounce;
        diagnosticsProvider.maxItems = config.diagnosticsProvider.maxItems;
        completionProvider.config = config.completionProvider;
    }

    export function openDocument(textDocument: lsp.TextDocumentItem) {

        if (textDocument.languageId !== phpLanguageId || documentStore.has(textDocument.uri)) {
            return;
        }

        let parsedDocument = new ParsedDocument(textDocument.uri, textDocument.text, textDocument.version);
        documentStore.add(parsedDocument);
        let symbolTable = SymbolTable.create(parsedDocument);
        symbolStore.add(symbolTable);
        let refTable = ReferenceReader.discoverReferences(parsedDocument, symbolStore);
        refStore.add(refTable);
        diagnosticsProvider.add(parsedDocument);

    }

    export function closeDocument(textDocument: lsp.TextDocumentIdentifier) {
        documentStore.remove(textDocument.uri);
        refStore.close(textDocument.uri);
        diagnosticsProvider.remove(textDocument.uri);
        let symbolTable = symbolStore.getSymbolTable(textDocument.uri);
        if (symbolTable) {
            symbolTable.pruneScopedVars();
            return symbolCache.write(symbolTable.uri, symbolTable).catch((msg) => { Log.error(msg) });
        }
    }

    export function editDocument(
        textDocument: lsp.VersionedTextDocumentIdentifier,
        contentChanges: lsp.TextDocumentContentChangeEvent[]) {

        let parsedDocument = documentStore.find(textDocument.uri);
        if (parsedDocument) {
            parsedDocument.version = textDocument.version;
            parsedDocument.applyChanges(contentChanges);
        }

    }

    export function documentSymbols(textDocument: lsp.TextDocumentIdentifier) {
        flushParseDebounce(textDocument.uri);
        return symbolProvider.provideDocumentSymbols(textDocument.uri);
    }

    export function workspaceSymbols(query: string) {
        return query ? symbolProvider.provideWorkspaceSymbols(query) : [];
    }

    export function provideCompletions(textDocument: lsp.TextDocumentIdentifier, position: lsp.Position) {
        flushParseDebounce(textDocument.uri);
        return completionProvider.provideCompletions(textDocument.uri, position);
    }

    export function provideSignatureHelp(textDocument: lsp.TextDocumentIdentifier, position: lsp.Position) {
        flushParseDebounce(textDocument.uri);
        return signatureHelpProvider.provideSignatureHelp(textDocument.uri, position);
    }

    export function provideDefinition(textDocument: lsp.TextDocumentIdentifier, position: lsp.Position) {
        flushParseDebounce(textDocument.uri);
        return definitionProvider.provideDefinition(textDocument.uri, position);
    }

    export function discoverSymbols(textDocument: lsp.TextDocumentItem) {

        let uri = textDocument.uri;

        if (documentStore.has(uri)) {
            //if document is in doc store/opened then dont rediscover
            //it will have symbols discovered already
            let symbolTable = symbolStore.getSymbolTable(uri);
            return symbolTable ? symbolTable.symbolCount : 0;
        }

        let text = textDocument.text;
        let parsedDocument = new ParsedDocument(uri, text, textDocument.version);
        let symbolTable = SymbolTable.create(parsedDocument, true);
        symbolTable.pruneScopedVars();
        symbolStore.add(symbolTable);
        return symbolCache.write(symbolTable.uri, symbolTable).then(() => {
            return symbolTable.symbolCount;
        }).catch((msg) => {
            Log.warn(msg);
            return symbolTable.symbolCount;
        });

    }

    export function discoverReferences(textDocument: lsp.TextDocumentItem) {
        let uri = textDocument.uri;
        let refTable = refStore.getReferenceTable(uri);

        if (documentStore.has(uri)) {
            //if document is in doc store/opened then dont rediscover.
            //it should have had refs discovered already
            return refTable ? refTable.referenceCount : 0;
        }

        if (!symbolStore.getSymbolTable(uri)) {
            //symbols must be discovered first
            return 0;
        }

        let text = textDocument.text;
        let parsedDocument = new ParsedDocument(uri, text, textDocument.version);
        refTable = ReferenceReader.discoverReferences(parsedDocument, symbolStore);
        refStore.add(refTable);
        refStore.close(refTable.uri);
        return refTable.referenceCount;
    }

    export function forget(uri: string) {
        symbolStore.remove(uri);
        refStore.remove(uri, true);
    }

    export function provideContractFqnTextEdits(uri: string, position: lsp.Position, alias?: string) {
        flushParseDebounce(uri);
        return nameTextEditProvider.provideContractFqnTextEdits(uri, position, alias);
    }

    export function numberDocumentsOpen() {
        return documentStore.count;
    }

    export function numberDocumentsKnown() {
        return symbolStore.tableCount;
    }

    export function numberSymbolsKnown() {
        return symbolStore.symbolCount;
    }

    export function provideDocumentFormattingEdits(doc: lsp.TextDocumentIdentifier, formatOptions: lsp.FormattingOptions) {
        flushParseDebounce(doc.uri);
        return formatProvider.provideDocumentFormattingEdits(doc, formatOptions);
    }

    export function provideDocumentRangeFormattingEdits(doc: lsp.TextDocumentIdentifier, range: lsp.Range, formatOptions: lsp.FormattingOptions) {
        flushParseDebounce(doc.uri);
        return formatProvider.provideDocumentRangeFormattingEdits(doc, range, formatOptions);
    }

    export function provideReferences(doc: lsp.TextDocumentIdentifier, pos: lsp.Position, context: lsp.ReferenceContext) {
        flushParseDebounce(doc.uri);
        return referenceProvider.provideReferenceLocations(doc.uri, pos, context);
    }

    function flushParseDebounce(uri: string) {
        let parsedDocument = documentStore.find(uri);
        if (parsedDocument) {
            parsedDocument.flush();
        }
    }

}

export interface IntelephenseConfig {
    debug: {
        enable: boolean;
    },
    diagnosticsProvider: {
        debounce: number,
        maxItems: number
    },
    completionProvider: {
        maxItems: number,
        addUseDeclaration: boolean,
        backslashPrefix: boolean
    },
    file: {
        maxSize: number
    }
}

export interface InitialisationOptions {
    storagePath: string;
    logWriter?: LogWriter;
    clearCache?: boolean;
}

export interface LanguageRangeList {
    version: number;
    ranges: LanguageRange[]
}

