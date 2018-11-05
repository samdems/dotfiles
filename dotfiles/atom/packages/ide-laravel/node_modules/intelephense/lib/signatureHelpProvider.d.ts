import * as lsp from 'vscode-languageserver-types';
import { SymbolStore } from './symbolStore';
import { ParsedDocumentStore } from './parsedDocument';
import { ReferenceStore } from './reference';
export declare class SignatureHelpProvider {
    symbolStore: SymbolStore;
    docStore: ParsedDocumentStore;
    refStore: ReferenceStore;
    constructor(symbolStore: SymbolStore, docStore: ParsedDocumentStore, refStore: ReferenceStore);
    provideSignatureHelp(uri: string, position: lsp.Position): lsp.SignatureHelp;
    private _createSignatureHelp(fn, argNumber);
    private _signatureInfo(fn, params);
    private _parameterInfoArray(params);
    private _parameterInfo(s);
    private _getSymbol(traverser);
    private _isCallablePhrase(node);
    private _isNamePhrase(node);
    private _isArgExprList(node);
    private _isMemberName(node);
    private _isScopedMemberName(node);
    private _isNameToken(node);
    private _isIdentifier(node);
    private _isClassTypeDesignator(node);
    private _isNamePhraseOrRelativeScope(node);
}
