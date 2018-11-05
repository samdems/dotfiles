# Intelephense

A PHP static code analysis library implemented in Typescript. A PHP language server implementation powered by this library can be found [here](https://github.com/bmewburn/intelephense-server).

### [Support on Patreon](https://www.patreon.com/bmewburn)

## Design Goals

* Support features defined by the Language Server Protocol.
* High performance for real-time analysis of source code within an IDE.
* Modern browser and nodejs compatibility.

## Interface

```typescript
export declare namespace Intelephense {
    function onDiagnosticsStart(fn: (uri: string) => void): void;
    function onPublishDiagnostics(fn: (args: PublishDiagnosticsEventArgs) => void): void;
    function initialise(): void;
    function setDiagnosticsProviderDebounce(value: number): void;
    function setDiagnosticsProviderMaxItems(value: number): void;
    function setCompletionProviderMaxItems(value: number): void;
    function openDocument(textDocument: lsp.TextDocumentItem): void;
    function closeDocument(textDocument: lsp.TextDocumentIdentifier): void;
    function editDocument(textDocument: lsp.VersionedTextDocumentIdentifier, contentChanges: lsp.TextDocumentContentChangeEvent[]): void;
    function documentSymbols(textDocument: lsp.TextDocumentIdentifier): lsp.SymbolInformation[];
    function workspaceSymbols(query: string): lsp.SymbolInformation[];
    function provideCompletions(textDocument: lsp.TextDocumentIdentifier, position: lsp.Position): lsp.CompletionList;
    function provideSignatureHelp(textDocument: lsp.TextDocumentIdentifier, position: lsp.Position): lsp.SignatureHelp;
    function provideDefinition(textDocument: lsp.TextDocumentIdentifier, position: lsp.Position): lsp.Location;
    function discover(textDocument: lsp.TextDocumentItem): number;
    function forget(uri: string): number;
    function numberDocumentsOpen(): number;
    function numberDocumentsKnown(): number;
    function numberSymbolsKnown(): number;
}
```
