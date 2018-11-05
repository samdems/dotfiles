/* 
 * Copyright (c) Ben Robert Mewburn
 * Licensed under the ISC Licence.
 * 
 */

'use strict';

import { PhpSymbol, SymbolKind } from './symbol';

export class NameResolver {

    private _classStack:PhpSymbol[];
    rules:PhpSymbol[];
    namespace:PhpSymbol;

    constructor() {
        this.rules = [];
        this._classStack = [];
     }

     get class() {
        return this._classStack.length ? this._classStack[this._classStack.length - 1] : undefined;
     }

     get namespaceName() {
         return this.namespace ? this.namespace.name : '';
     }

     get className(){
         return this._classStack.length ? this._classStack[this._classStack.length - 1].name : '';
     }

     get classBaseName(){
         let s = this.class;
         if(!s || !s.associated) {
             return '';
         }
         let base = s.associated.find((x)=>{
            return x.kind === SymbolKind.Class;
         });
         return base ? base.name : '';
     }

     pushClass(symbol:PhpSymbol){
        this._classStack.push(symbol);
     }

     popClass(){
         this._classStack.pop();
     }

    resolveRelative(relativeName: string) {
        return this.concatNamespaceName(this.namespaceName, relativeName);
    }

    resolveNotFullyQualified(notFqn: string, kind?: SymbolKind, resolveStatic?:boolean) {

        if (!notFqn) {
            return '';
        }

        let lcNotFqn = notFqn.toLowerCase();

        switch(lcNotFqn) {
            case 'self':
                return this.className;
            case 'static':
            case '$this':
                return resolveStatic ? this.className : lcNotFqn;
            case 'parent':
                return this.classBaseName;
            default:
                break;
        }

        let pos = notFqn.indexOf('\\');
        return pos < 0 ?
            this._resolveUnqualified(notFqn, kind ? kind : SymbolKind.Class) :
            this._resolveQualified(notFqn, pos);
    }

    concatNamespaceName(prefix: string, suffix: string) {
        if (!suffix || !prefix) {
            return suffix;
        } else {
            return prefix + '\\' + suffix;
        }
    }

    /**
     * 
     * @param text unqualified name
     * @param kind 
     */
    matchImportedSymbol(text: string, kind: SymbolKind) {
        
        if(kind !== SymbolKind.Constant) {
            text = text.toLowerCase();
        }
        let s: PhpSymbol;

        for (let n = 0, l = this.rules.length; n < l; ++n) {
            s = this.rules[n];
            if (
                s.name && s.kind === kind && 
                ((kind === SymbolKind.Constant && text === s.name) || 
                (kind !== SymbolKind.Constant && text === s.name.toLowerCase()))) {
                return s;
            }
        }
        return null;
    }

    private _resolveQualified(name: string, pos: number) {
        let s = this.matchImportedSymbol(name.slice(0, pos), SymbolKind.Class);
        return s ? s.associated[0].name + name.slice(pos) : this.resolveRelative(name);
    }

    private _resolveUnqualified(name: string, kind: SymbolKind) {
        if(kind === SymbolKind.Constructor) {
            kind = SymbolKind.Class;
        }
        let s = this.matchImportedSymbol(name, kind);
        return s ? s.associated[0].name : this.resolveRelative(name);
    }

}