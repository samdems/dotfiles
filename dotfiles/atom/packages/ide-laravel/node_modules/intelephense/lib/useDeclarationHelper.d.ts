import { ParsedDocument } from './parsedDocument';
import { SymbolTable } from './symbolStore';
import { PhpSymbol, SymbolIdentifier } from './symbol';
import { Position, TextEdit, Range } from 'vscode-languageserver-types';
import { Phrase } from 'php7parser';
export declare class UseDeclarationHelper {
    doc: ParsedDocument;
    table: SymbolTable;
    private _useDeclarations;
    private _afterNode;
    private _afterNodeRange;
    private _cursor;
    constructor(doc: ParsedDocument, table: SymbolTable, cursor: Position);
    insertDeclarationTextEdit(symbol: SymbolIdentifier, alias?: string): TextEdit;
    replaceDeclarationTextEdit(symbol: SymbolIdentifier, alias: string): TextEdit;
    deleteDeclarationTextEdit(fqn: string): void;
    findUseSymbolByFqn(fqn: string): PhpSymbol;
    findUseSymbolByName(name: string): PhpSymbol;
    findNamespaceUseClauseByRange(range: Range): Phrase;
    private _isUseDeclarationSymbol(s);
    private _insertAfterNode();
    private _insertAfterNodeRange();
    private _insertPosition();
    private _isNamespaceAliasingClause(node);
}
