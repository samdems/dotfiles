'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
class NameResolver {
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
    get className() {
        return this._classStack.length ? this._classStack[this._classStack.length - 1].name : '';
    }
    get classBaseName() {
        let s = this.class;
        if (!s || !s.associated) {
            return '';
        }
        let base = s.associated.find((x) => {
            return x.kind === 1;
        });
        return base ? base.name : '';
    }
    pushClass(symbol) {
        this._classStack.push(symbol);
    }
    popClass() {
        this._classStack.pop();
    }
    resolveRelative(relativeName) {
        return this.concatNamespaceName(this.namespaceName, relativeName);
    }
    resolveNotFullyQualified(notFqn, kind, resolveStatic) {
        if (!notFqn) {
            return '';
        }
        let lcNotFqn = notFqn.toLowerCase();
        switch (lcNotFqn) {
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
            this._resolveUnqualified(notFqn, kind ? kind : 1) :
            this._resolveQualified(notFqn, pos);
    }
    concatNamespaceName(prefix, suffix) {
        if (!suffix || !prefix) {
            return suffix;
        }
        else {
            return prefix + '\\' + suffix;
        }
    }
    matchImportedSymbol(text, kind) {
        if (kind !== 8) {
            text = text.toLowerCase();
        }
        let s;
        for (let n = 0, l = this.rules.length; n < l; ++n) {
            s = this.rules[n];
            if (s.name && s.kind === kind &&
                ((kind === 8 && text === s.name) ||
                    (kind !== 8 && text === s.name.toLowerCase()))) {
                return s;
            }
        }
        return null;
    }
    _resolveQualified(name, pos) {
        let s = this.matchImportedSymbol(name.slice(0, pos), 1);
        return s ? s.associated[0].name + name.slice(pos) : this.resolveRelative(name);
    }
    _resolveUnqualified(name, kind) {
        if (kind === 2048) {
            kind = 1;
        }
        let s = this.matchImportedSymbol(name, kind);
        return s ? s.associated[0].name : this.resolveRelative(name);
    }
}
exports.NameResolver = NameResolver;
