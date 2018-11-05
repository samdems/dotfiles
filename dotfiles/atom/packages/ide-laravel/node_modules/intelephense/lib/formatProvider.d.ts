import * as lsp from 'vscode-languageserver-types';
import { ParsedDocumentStore } from './parsedDocument';
export declare class FormatProvider {
    docStore: ParsedDocumentStore;
    private static blkLinePattern;
    constructor(docStore: ParsedDocumentStore);
    provideDocumentFormattingEdits(doc: lsp.TextDocumentIdentifier, formatOptions: lsp.FormattingOptions): lsp.TextEdit[];
    provideDocumentRangeFormattingEdits(doc: lsp.TextDocumentIdentifier, range: lsp.Range, formatOptions: lsp.FormattingOptions): lsp.TextEdit[];
    private _isCloseTag(t);
}
