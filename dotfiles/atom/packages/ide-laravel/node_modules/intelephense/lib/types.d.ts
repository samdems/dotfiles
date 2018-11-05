import { Range } from 'vscode-languageserver-types';
export interface Predicate<T> {
    (t: T): boolean;
}
export interface DebugLogger {
    debug(message: string): void;
}
export interface EventHandler<T> {
    (t: T): void;
}
export interface Unsubscribe {
    (): void;
}
export declare class Event<T> {
    private _subscribed;
    constructor();
    subscribe(handler: EventHandler<T>): Unsubscribe;
    trigger(args: T): void;
}
export interface HashedLocation {
    uriHash: number;
    range: Range;
}
export declare namespace HashedLocation {
    function create(uriHash: number, range: Range): HashedLocation;
}
export interface TreeLike {
    [index: string]: any;
    children?: TreeLike[];
}
export declare class TreeTraverser<T extends TreeLike> {
    protected _spine: T[];
    constructor(spine: T[]);
    readonly spine: T[];
    readonly node: T;
    traverse(visitor: TreeVisitor<T>): void;
    filter(predicate: Predicate<T>): T[];
    toArray(): T[];
    count(): number;
    depth(): number;
    up(n: number): void;
    find(predicate: Predicate<T>): T;
    child(predicate: Predicate<T>): T;
    nthChild(n: number): T;
    childCount(): number;
    prevSibling(): T;
    nextSibling(): T;
    ancestor(predicate: Predicate<T>): T;
    parent(): T;
    clone(): TreeTraverser<T>;
    private _traverse(treeNode, visitor, spine);
}
export interface Traversable<T extends TreeLike> {
    traverse(visitor: TreeVisitor<T>): TreeVisitor<T>;
}
export interface TreeVisitor<T extends TreeLike> {
    haltTraverse?: boolean;
    preorder?(node: T, spine: T[]): boolean;
    postorder?(node: T, spine: T[]): void;
}
export declare class Debounce<T> {
    wait: number;
    private _handler;
    private _lastEvent;
    private _timer;
    constructor(handler: (e: T) => void, wait: number);
    clear: () => void;
    handle(event: T): void;
    flush(): void;
}
export declare class ToArrayVisitor<T> implements TreeVisitor<T> {
    private _array;
    constructor();
    readonly array: T[];
    preorder(t: T, spine: T[]): boolean;
}
export declare class CountVisitor<T> implements TreeVisitor<T> {
    private _count;
    constructor();
    readonly count: number;
    preorder(t: T, spine: T[]): boolean;
}
export declare class MultiVisitor<T> implements TreeVisitor<T> {
    protected _visitors: [TreeVisitor<T>, TreeLike][];
    haltTraverse: boolean;
    constructor(visitors: TreeVisitor<T>[]);
    add(v: TreeVisitor<T>): void;
    preorder(node: T, spine: T[]): boolean;
    postorder(node: T, spine: T[]): void;
}
export declare class BinarySearch<T> {
    private _sortedArray;
    constructor(sortedArray: T[]);
    find(compare: (n: T) => number): T;
    rank(compare: (n: T) => number): number;
    range(compareLower: (n: T) => number, compareUpper: (n: T) => number): T[];
    search(compare: (n: T) => number, offset?: number): BinarySearchResult;
}
export interface BinarySearchResult {
    rank: number;
    isExactMatch: boolean;
}
export interface NameIndexNode<T> {
    key: string;
    items: T[];
}
export declare type KeysDelegate<T> = (t: T) => string[];
export declare class NameIndex<T> {
    private _keysDelegate;
    private _nodeArray;
    private _binarySearch;
    private _collator;
    constructor(keysDelegate: KeysDelegate<T>);
    add(item: T): void;
    addMany(items: T[]): void;
    remove(item: T): void;
    removeMany(items: T[]): void;
    match(text: string): T[];
    matchIterator(text: string): IterableIterator<T>;
    find(text: string): T[];
    toJSON(): NameIndexNode<T>[];
    fromJSON(data: NameIndexNode<T>[]): void;
    private _nodeMatch(lcText);
    private _nodeFind(lcText);
    private _insertNode(node);
    private _deleteNode(node);
}
export declare type Comparer<T> = (a: T, b: T) => number;
export declare class SortedList<T> {
    protected compareFn: Comparer<T>;
    protected _items: T[];
    protected _search: BinarySearch<T>;
    constructor(compareFn: Comparer<T>, items?: T[]);
    readonly length: number;
    readonly items: T[];
    add(item: T): void;
    remove(compareFn: (t: T) => number): T;
    find(compareFn: (t: T) => number): T;
    private _createCompareClosure(item, cmpFn);
}
