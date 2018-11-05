import { PhpSymbol } from './symbol';
import { SymbolStore } from './symbolStore';
import { Predicate } from './types';
export declare const enum MemberMergeStrategy {
    None = 0,
    Override = 1,
    Documented = 2,
    Base = 3,
}
export declare class TypeAggregate {
    symbolStore: SymbolStore;
    private _symbol;
    private _associated;
    private _excludeTraits;
    constructor(symbolStore: SymbolStore, symbol: PhpSymbol | PhpSymbol[], excludeTraits?: boolean);
    readonly type: PhpSymbol | PhpSymbol[];
    readonly name: string;
    isBaseClass(name: string): boolean;
    isAssociated(name: string): boolean;
    associated(filter?: Predicate<PhpSymbol>): PhpSymbol[];
    firstMember(predicate: Predicate<PhpSymbol>): PhpSymbol;
    members(mergeStrategy: MemberMergeStrategy, predicate?: Predicate<PhpSymbol>): PhpSymbol[];
    private _resolveThisAndStaticReturnType(members, name);
    private _classMembers(associated, strategy, predicate?);
    private _interfaceMembers(interfaces, predicate?);
    private _traitMembers(traits, predicate?);
    private _mergeMembers(symbols, strategy);
    private hasInheritdoc(description);
    private _getAssociated();
    private _symbolsAssociatedReduce(accum, current);
    private _associatedIterator();
    static create(symbolStore: SymbolStore, fqn: string): TypeAggregate;
}
