import { Predicate, TreeVisitor, TreeTraverser, Traversable } from './types';
import { SymbolIdentifier, SymbolKind } from './symbol';
import { Location, Position } from 'vscode-languageserver-types';
import { Cache } from './cache';
export interface Reference extends SymbolIdentifier {
    location: Location;
    type?: string;
    altName?: string;
}
export declare namespace Reference {
    function create(kind: SymbolKind, name: string, location: Location): Reference;
}
export interface Scope {
    location: Location;
    children: (Scope | Reference)[];
}
export declare namespace Scope {
    function create(location: Location): Scope;
}
export declare class ReferenceTable implements Traversable<Scope | Reference> {
    private _uri;
    private _root;
    private _hash;
    constructor(uri: string, root: Scope, hash?: number);
    readonly uri: string;
    readonly root: Scope;
    readonly hash: number;
    readonly referenceCount: number;
    references(filter?: Predicate<Reference>): Reference[];
    referenceAtPosition(position: Position): Reference;
    scopeAtPosition(position: Position): Scope;
    createTraverser(): TreeTraverser<Scope | Reference>;
    traverse(visitor: TreeVisitor<Scope | Reference>): TreeVisitor<Reference | Scope>;
    static fromJSON(data: any): ReferenceTable;
}
export interface ReferenceTableSummary {
    uri: string;
    identifiers: string[];
}
export declare class ReferenceStore {
    private _tables;
    private _nameIndex;
    private _summaryIndex;
    private _cache;
    constructor(cache: Cache);
    knownDocuments(): IterableIterator<string>;
    getReferenceTable(uri: string): ReferenceTable;
    add(table: ReferenceTable): void;
    remove(uri: string, purge?: boolean): void;
    close(uri: string): Promise<void>;
    closeAll(): Promise<void>;
    find(name: string, filter?: Predicate<Reference>): Promise<Reference[]>;
    fromJSON(data: ReferenceTableSummary[]): void;
    toJSON(): ReferenceTableSummary[];
    private _findInTables(tables, name, filter?);
    private _fetchTable;
    private _tablesRemove(uri);
    private _summaryRemove(uri);
}
