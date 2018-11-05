/* Copyright (c) Ben Robert Mewburn
 * Licensed under the ISC Licence.
 */

'use strict';

import { PhpSymbol, SymbolKind, SymbolModifier } from './symbol';
import { SymbolStore } from './symbolStore';
import { Predicate } from './types';
import * as util from './util';
import {TypeString} from './typeString';

export const enum MemberMergeStrategy {
    None, //returns all symbols
    Override, //first matching member encountered is chosen ie prefer overrides
    Documented, //prefer first unless it has no doc and base does
    Base //last matching member encountered ie prefer base
}

export class TypeAggregate {

    private _symbol: PhpSymbol | PhpSymbol[];
    private _associated: PhpSymbol[];
    private _excludeTraits = false;

    constructor(public symbolStore: SymbolStore, symbol: PhpSymbol | PhpSymbol[], excludeTraits?:boolean) {
        if (!symbol) {
            throw new Error('Invalid Argument');
        }
        this._symbol = symbol;
        this._excludeTraits = excludeTraits;
    }

    get type() {
        return this._symbol;
    }

    get name() {
        return Array.isArray(this._symbol) ? this._symbol[0].name : this._symbol.name;
    }

    isBaseClass(name:string) {
        let lcName = name.toLowerCase();
        let fn = (x:PhpSymbol) => {
            return x.kind === SymbolKind.Class && lcName === x.name.toLowerCase();
        }
        return !!this.associated(fn);
    }

    isAssociated(name: string) {
        if (!name) {
            return false;
        }
        let lcName = name.toLowerCase();
        let fn = (x: PhpSymbol) => {
            return x.name.toLowerCase() === lcName;
        }
        return this.associated(fn).length > 0;
    }

    associated(filter?: Predicate<PhpSymbol>) {
        let assoc = this._getAssociated();
        return filter ? util.filter(assoc, filter) : assoc;
    }

    firstMember(predicate:Predicate<PhpSymbol>) {
        let member:PhpSymbol;

        let symbols = Array.isArray(this._symbol) ? this._symbol : [this._symbol];
        for(let n = 0; n < symbols.length; ++n) {
            if((member = PhpSymbol.findChild(symbols[n], predicate))) {
                return member;
            }
        }

        for(let s of this._associatedIterator()) {
            if((member = PhpSymbol.findChild(s, predicate))) {
                return member;
            }
        }
        return undefined;
    }

    members(mergeStrategy: MemberMergeStrategy, predicate?: Predicate<PhpSymbol>) {

        let associated = this._getAssociated().slice(0);
        let kind:SymbolKind;
        let name:string;

        if(Array.isArray(this._symbol)) {
            associated.unshift(...this._symbol);
            kind = this._symbol[0].kind;
            name = this._symbol[0].name;
        } else {
            associated.unshift(this._symbol);
            kind = this._symbol.kind;
            name = this._symbol.name;
        }
        
        let members:PhpSymbol[];

        switch (kind) {
            case SymbolKind.Class:
                members = this._classMembers(associated, mergeStrategy, predicate);
                break;
            case SymbolKind.Interface:
                members = this._interfaceMembers(associated, predicate);
                break;
            case SymbolKind.Trait:
                members = this._traitMembers(associated, predicate);
                break;
            default:
                members = [];
                break;
        }

        //$this and static return types are resolved to fqn at this point as fqn is known
        return this._resolveThisAndStaticReturnType(members, name);

    }

    private _resolveThisAndStaticReturnType(members:PhpSymbol[], name:string) {

        let resolved:PhpSymbol[] = [];
        let s:PhpSymbol;
        let type:string;
        let sClone:PhpSymbol;

        for(let n = 0; n < members.length; ++n) {
            s = members[n];
            if((s.kind & (SymbolKind.Method | SymbolKind.Property)) > 0 && s.doc && s.doc.type) {
                type = TypeString.resolveThisOrStatic(s.doc.type, name);
                
                if(type !== s.doc.type) {
                    //clone the symbol to use resolved type
                    sClone = PhpSymbol.clone(s);
                    sClone.doc = {description:s.doc.description, type:type}
                    resolved.push(sClone);
                    continue;
                }
            }
            resolved.push(s);
        }
        
        return resolved;

    }

    /**
     * root type should be first element of associated array
     * @param associated 
     * @param predicate 
     */
    private _classMembers(associated: PhpSymbol[], strategy:MemberMergeStrategy, predicate?: Predicate<PhpSymbol>) {

        let members: PhpSymbol[] = [];
        let s: PhpSymbol;
        let traits: PhpSymbol[] = [];
        let p = predicate;
        let noPrivate = (x: PhpSymbol) => {
            return !(x.modifiers & SymbolModifier.Private) && (!predicate || predicate(x));
        };

        for (let n = 0; n < associated.length; ++n) {
            s = associated[n];
            if (s.kind === SymbolKind.Trait) {
                traits.push(s);
            } else if (s.children) {
                Array.prototype.push.apply(members, p ? s.children.filter(p) : s.children);
            }

            p = noPrivate;
        }

        p = noPrivate;
        members = this._mergeMembers(members, strategy);
        //@todo trait precendence/alias
        Array.prototype.push.apply(members, this._traitMembers(traits, p));
        return members;

    }

    private _interfaceMembers(interfaces: PhpSymbol[], predicate?: Predicate<PhpSymbol>) {
        let members: PhpSymbol[] = [];
        let s: PhpSymbol;
        for (let n = 0; n < interfaces.length; ++n) {
            s = interfaces[n];
            if (s.children) {
                Array.prototype.push.apply(members, predicate ? s.children.filter(predicate) : s.children);
            }
        }
        return members;
    }

    private _traitMembers(traits: PhpSymbol[], predicate?: Predicate<PhpSymbol>) {
        //@todo support trait precendence and alias here
        return this._interfaceMembers(traits, predicate);
    }

    private _mergeMembers(symbols: PhpSymbol[], strategy: MemberMergeStrategy) {

        let map: { [index: string]: PhpSymbol } = {};
        let s: PhpSymbol;
        let mapped:PhpSymbol;

        if (strategy === MemberMergeStrategy.None) {
            return symbols;
        }

        for (let n = 0; n < symbols.length; ++n) {
            s = symbols[n];
            mapped = map[s.name];
            if (
                !mapped ||
                ((mapped.modifiers & SymbolModifier.Magic) > 0 && !(s.modifiers & SymbolModifier.Magic)) || //always prefer non magic
                (strategy === MemberMergeStrategy.Documented && (!mapped.doc || this.hasInheritdoc(mapped.doc.description)) && s.doc) ||
                (strategy === MemberMergeStrategy.Base)
            ) {
                map[s.name] = s;
            } 
            
        }

        return Object.keys(map).map((v:string)=>{ return map[v]; });
    }

    private hasInheritdoc(description:string) {
        if(!description) {
            return false;
        }

        description = description.toLowerCase().trim();
        return description === '@inheritdoc' || description === '{@inheritdoc}';
    }

    private _getAssociated() {

        if (this._associated) {
            return this._associated;
        }

        return this._associated = Array.from(this._associatedIterator());

    }

    private _symbolsAssociatedReduce(accum:PhpSymbol[], current:PhpSymbol) {
        if(current.associated) {
            Array.prototype.push.apply(accum, current.associated);
        }
        return accum;
    }

    private *_associatedIterator() {

        let associated = new Set<PhpSymbol>();
        let symbols:PhpSymbol[];
        let queue: PhpSymbol[] = [];
        let stub: PhpSymbol;
        let s:PhpSymbol;
        
        if(Array.isArray(this._symbol)) {
            Array.prototype.push.apply(queue, this._symbol.reduce(this._symbolsAssociatedReduce, []));
        } else if(this._symbol.associated) {
            Array.prototype.push.apply(queue, this._symbol.associated);
        }

        let filterFn = (x:PhpSymbol) => {
            return PhpSymbol.isClassLike(x) && !associated.has(x);
        }

        while ((stub = queue.shift())) {

            if(this._excludeTraits && stub.kind === SymbolKind.Trait) {
                continue;
            }

            symbols = this.symbolStore.find(stub.name, filterFn);
            for(let n = 0; n < symbols.length; ++n) {
                s = symbols[n];
                associated.add(s);
                if(s.associated) {
                    Array.prototype.push.apply(queue, s.associated);
                }
                yield s;
            }
        }

    }

    static create(symbolStore: SymbolStore, fqn: string) {

        if (!fqn) {
            return null;
        }

        let symbols = symbolStore.find(fqn, PhpSymbol.isClassLike);
        if (!symbols.length) {
            return null;
        } else if(symbols.length === 1) {
            return new TypeAggregate(symbolStore, symbols[0]);    
        } else {
            return new TypeAggregate(symbolStore, symbols);
        }

    }

}