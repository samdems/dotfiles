import { LanguageRange } from './parsedDocument';
import { PublishDiagnosticsEventArgs } from './diagnosticsProvider';
import * as lsp from 'vscode-languageserver-types';
import { LogWriter } from './logger';
export { LanguageRange } from './parsedDocument';
export declare namespace Intelephense {
    function onPublishDiagnostics(fn: (args: PublishDiagnosticsEventArgs) => void): void;
    function initialise(options: InitialisationOptions): Promise<void>;
    function shutdown(): Promise<void>;
    function provideHighlights(uri: string, position: lsp.Position): lsp.DocumentHighlight[];
    function provideHover(uri: string, position: lsp.Position): lsp.Hover;
    function knownDocuments(): {
        timestamp: number;
        documents: string[];
    };
    function documentLanguageRanges(textDocument: lsp.TextDocumentIdentifier): LanguageRangeList;
    function setConfig(config: IntelephenseConfig): void;
    function openDocument(textDocument: lsp.TextDocumentItem): void;
    function closeDocument(textDocument: lsp.TextDocumentIdentifier): Promise<void>;
    function editDocument(textDocument: lsp.VersionedTextDocumentIdentifier, contentChanges: lsp.TextDocumentContentChangeEvent[]): void;
    function documentSymbols(textDocument: lsp.TextDocumentIdentifier): lsp.SymbolInformation[];
    function workspaceSymbols(query: string): lsp.SymbolInformation[];
    function provideCompletions(textDocument: lsp.TextDocumentIdentifier, position: lsp.Position): lsp.CompletionList;
    function provideSignatureHelp(textDocument: lsp.TextDocumentIdentifier, position: lsp.Position): lsp.SignatureHelp;
    function provideDefinition(textDocument: lsp.TextDocumentIdentifier, position: lsp.Position): lsp.Location | lsp.Location[];
    function discoverSymbols(textDocument: lsp.TextDocumentItem): number | Promise<number>;
    function discoverReferences(textDocument: lsp.TextDocumentItem): number;
    function forget(uri: string): void;
    function provideContractFqnTextEdits(uri: string, position: lsp.Position, alias?: string): lsp.TextEdit[];
    function numberDocumentsOpen(): number;
    function numberDocumentsKnown(): number;
    function numberSymbolsKnown(): number;
    function provideDocumentFormattingEdits(doc: lsp.TextDocumentIdentifier, formatOptions: lsp.FormattingOptions): lsp.TextEdit[];
    function provideDocumentRangeFormattingEdits(doc: lsp.TextDocumentIdentifier, range: lsp.Range, formatOptions: lsp.FormattingOptions): lsp.TextEdit[];
    function provideReferences(doc: lsp.TextDocumentIdentifier, pos: lsp.Position, context: lsp.ReferenceContext): Promise<lsp.Location[]>;
}
export interface IntelephenseConfig {
    debug: {
        enable: boolean;
    };
    diagnosticsProvider: {
        debounce: number;
        maxItems: number;
    };
    completionProvider: {
        maxItems: number;
        addUseDeclaration: boolean;
        backslashPrefix: boolean;
    };
    file: {
        maxSize: number;
    };
}
export interface InitialisationOptions {
    storagePath: string;
    logWriter?: LogWriter;
    clearCache?: boolean;
}
export interface LanguageRangeList {
    version: number;
    ranges: LanguageRange[];
}
