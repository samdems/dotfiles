'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
const intelephense_1 = require("intelephense");
let connection = vscode_languageserver_1.createConnection();
let initialisedAt;
const languageId = 'php';
const discoverSymbolsRequest = new vscode_languageserver_1.RequestType('discoverSymbols');
const discoverReferencesRequest = new vscode_languageserver_1.RequestType('discoverReferences');
const forgetRequest = new vscode_languageserver_1.RequestType('forget');
const importSymbolRequest = new vscode_languageserver_1.RequestType('importSymbol');
const documentLanguageRangesRequest = new vscode_languageserver_1.RequestType('documentLanguageRanges');
const knownDocumentsRequest = new vscode_languageserver_1.RequestType('knownDocuments');
let config = {
    debug: {
        enable: false
    },
    completionProvider: {
        maxItems: 100,
        addUseDeclaration: true,
        backslashPrefix: false
    },
    diagnosticsProvider: {
        debounce: 1000,
        maxItems: 100
    },
    file: {
        maxSize: 1000000
    },
    formatProvider: {
        enable: true
    }
};
connection.onInitialize((params) => {
    initialisedAt = process.hrtime();
    connection.console.info('Initialising');
    let initOptions = {
        storagePath: params.initializationOptions.storagePath,
        logWriter: {
            info: connection.console.info,
            warn: connection.console.warn,
            error: connection.console.error
        },
        clearCache: params.initializationOptions.clearCache
    };
    return intelephense_1.Intelephense.initialise(initOptions).then(() => {
        intelephense_1.Intelephense.onPublishDiagnostics((args) => {
            connection.sendDiagnostics(args);
        });
        connection.console.info(`Initialised in ${elapsed(initialisedAt).toFixed()} ms`);
        return {
            capabilities: {
                textDocumentSync: vscode_languageserver_1.TextDocumentSyncKind.Incremental,
                documentSymbolProvider: true,
                workspaceSymbolProvider: true,
                completionProvider: {
                    triggerCharacters: [
                        '$', '>', ':', '\\',
                        '.', '<', '/'
                    ]
                },
                signatureHelpProvider: {
                    triggerCharacters: ['(', ',']
                },
                definitionProvider: true,
                documentRangeFormattingProvider: false,
                referencesProvider: true,
                documentLinkProvider: { resolveProvider: false },
                hoverProvider: true,
                documentHighlightProvider: true
            }
        };
    });
});
let docFormatRegister = null;
connection.onDidChangeConfiguration((params) => {
    let settings = params.settings.intelephense;
    if (!settings) {
        return;
    }
    config = settings;
    intelephense_1.Intelephense.setConfig(config);
    let enableFormatter = config.formatProvider && config.formatProvider.enable;
    if (enableFormatter) {
        let documentSelector = [{ language: languageId, scheme: 'file' }];
        if (!docFormatRegister) {
            docFormatRegister = connection.client.register(vscode_languageserver_1.DocumentRangeFormattingRequest.type, { documentSelector });
        }
    }
    else {
        if (docFormatRegister) {
            docFormatRegister.then(r => r.dispose());
            docFormatRegister = null;
        }
    }
});
connection.onDocumentLinks((params) => {
    return [];
});
connection.onHover((params) => {
    return intelephense_1.Intelephense.provideHover(params.textDocument.uri, params.position);
});
connection.onDocumentHighlight((params) => {
    return intelephense_1.Intelephense.provideHighlights(params.textDocument.uri, params.position);
});
connection.onDidOpenTextDocument((params) => {
    if (params.textDocument.text.length > config.file.maxSize) {
        connection.console.warn(`${params.textDocument.uri} not opened -- over max file size.`);
        return;
    }
    intelephense_1.Intelephense.openDocument(params.textDocument);
});
connection.onDidChangeTextDocument((params) => {
    intelephense_1.Intelephense.editDocument(params.textDocument, params.contentChanges);
});
connection.onDidCloseTextDocument((params) => {
    intelephense_1.Intelephense.closeDocument(params.textDocument);
});
connection.onDocumentSymbol((params) => {
    return intelephense_1.Intelephense.documentSymbols(params.textDocument);
});
connection.onWorkspaceSymbol((params) => {
    return intelephense_1.Intelephense.workspaceSymbols(params.query);
});
connection.onReferences((params) => {
    return intelephense_1.Intelephense.provideReferences(params.textDocument, params.position, params.context);
});
connection.onCompletion((params) => {
    return intelephense_1.Intelephense.provideCompletions(params.textDocument, params.position);
});
connection.onSignatureHelp((params) => {
    return intelephense_1.Intelephense.provideSignatureHelp(params.textDocument, params.position);
});
connection.onDefinition((params) => {
    return intelephense_1.Intelephense.provideDefinition(params.textDocument, params.position);
});
connection.onDocumentRangeFormatting((params) => {
    return intelephense_1.Intelephense.provideDocumentRangeFormattingEdits(params.textDocument, params.range, params.options);
});
connection.onShutdown(intelephense_1.Intelephense.shutdown);
connection.onRequest(discoverSymbolsRequest, (params) => {
    if (params.textDocument.text.length > config.file.maxSize) {
        connection.console.warn(`${params.textDocument.uri} exceeds max file size.`);
        return 0;
    }
    return intelephense_1.Intelephense.discoverSymbols(params.textDocument);
});
connection.onRequest(discoverReferencesRequest, (params) => {
    if (params.textDocument.text.length > config.file.maxSize) {
        connection.console.warn(`${params.textDocument.uri} exceeds max file size.`);
        return 0;
    }
    return intelephense_1.Intelephense.discoverReferences(params.textDocument);
});
connection.onRequest(forgetRequest, (params) => {
    return intelephense_1.Intelephense.forget(params.uri);
});
connection.onRequest(importSymbolRequest, (params) => {
    return intelephense_1.Intelephense.provideContractFqnTextEdits(params.uri, params.position, params.alias);
});
connection.onRequest(knownDocumentsRequest, () => {
    return intelephense_1.Intelephense.knownDocuments();
});
connection.onRequest(documentLanguageRangesRequest, (params) => {
    return intelephense_1.Intelephense.documentLanguageRanges(params.textDocument);
});
connection.listen();
function elapsed(start) {
    if (!start) {
        return -1;
    }
    let diff = process.hrtime(start);
    return diff[0] * 1000 + diff[1] / 1000000;
}
