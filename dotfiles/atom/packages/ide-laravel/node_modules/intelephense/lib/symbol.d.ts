import { Predicate, HashedLocation } from './types';
export declare const enum SymbolKind {
    None = 0,
    Class = 1,
    Interface = 2,
    Trait = 4,
    Constant = 8,
    Property = 16,
    Method = 32,
    Function = 64,
    Parameter = 128,
    Variable = 256,
    Namespace = 512,
    ClassConstant = 1024,
    Constructor = 2048,
    File = 4096,
}
export declare const enum SymbolModifier {
    None = 0,
    Public = 1,
    Protected = 2,
    Private = 4,
    Final = 8,
    Abstract = 16,
    Static = 32,
    ReadOnly = 64,
    WriteOnly = 128,
    Magic = 256,
    Anonymous = 512,
    Reference = 1024,
    Variadic = 2048,
    Use = 4096,
}
export interface PhpSymbolDoc {
    description?: string;
    type?: string;
}
export declare namespace PhpSymbolDoc {
    function create(description?: string, type?: string): PhpSymbolDoc;
}
export interface PhpSymbol extends SymbolIdentifier {
    modifiers?: SymbolModifier;
    doc?: PhpSymbolDoc;
    type?: string;
    associated?: PhpSymbol[];
    children?: PhpSymbol[];
    value?: string;
    location?: HashedLocation;
}
export interface SymbolIdentifier {
    kind: SymbolKind;
    name: string;
    scope?: string;
}
export declare namespace PhpSymbol {
    function keys(s: PhpSymbol): string[];
    function isClassLike(s: PhpSymbol): boolean;
    function signatureString(s: PhpSymbol, excludeTypeInfo?: boolean): string;
    function hasParameters(s: PhpSymbol): boolean;
    function notFqn(text: string): string;
    function namespace(fqn: string): string;
    function clone(s: PhpSymbol): PhpSymbol;
    function type(s: PhpSymbol): string;
    function setScope(symbols: PhpSymbol[], scope: string): PhpSymbol[];
    function create(kind: SymbolKind, name: string, location?: HashedLocation): PhpSymbol;
    function filterChildren(parent: PhpSymbol, fn: Predicate<PhpSymbol>): PhpSymbol[];
    function findChild(parent: PhpSymbol, fn: Predicate<PhpSymbol>): PhpSymbol;
    function isAssociated(symbol: PhpSymbol, name: string): PhpSymbol;
    function unique(symbols: PhpSymbol[]): PhpSymbol[];
}
export declare class UniqueSymbolSet {
    private _symbols;
    private _map;
    constructor();
    add(s: PhpSymbol): void;
    has(s: PhpSymbol): boolean;
    toArray(): PhpSymbol[];
}
