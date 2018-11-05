import { ParsedDocument } from './parsedDocument';
import { Event } from './types';
import * as lsp from 'vscode-languageserver-types';
export interface PublishDiagnosticsEventArgs {
    uri: string;
    diagnostics: lsp.Diagnostic[];
}
export declare class DiagnosticsProvider {
    maxItems: number;
    private _docs;
    private _debounceWaitTime;
    private _publish;
    private _startDiagnostics;
    private _debounceMap;
    private _unsubscribeMap;
    private _maxItems;
    private _onParsedDocumentChanged;
    constructor();
    readonly startDiagnosticsEvent: Event<string>;
    readonly publishDiagnosticsEvent: Event<PublishDiagnosticsEventArgs>;
    add(doc: ParsedDocument): void;
    remove(uri: string): void;
    has(uri: string): boolean;
    debounceWait: number;
    private _diagnose(uri);
    private _parseErrorToDiagnostic(err, doc);
    private _message(err);
    private _errorRange(err, doc);
}
