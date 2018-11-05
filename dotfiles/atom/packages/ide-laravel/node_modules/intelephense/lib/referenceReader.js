'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const symbol_1 = require("./symbol");
const nameResolver_1 = require("./nameResolver");
const lsp = require("vscode-languageserver-types");
const typeString_1 = require("./typeString");
const typeAggregate_1 = require("./typeAggregate");
const util = require("./util");
const phpDoc_1 = require("./phpDoc");
const reference_1 = require("./reference");
function symbolsToTypeReduceFn(prev, current, index, array) {
    return typeString_1.TypeString.merge(prev, symbol_1.PhpSymbol.type(current));
}
class ReferenceReader {
    constructor(doc, nameResolver, symbolStore) {
        this.doc = doc;
        this.nameResolver = nameResolver;
        this.symbolStore = symbolStore;
        this._symbolFilter = (x) => {
            const mask = 512 | 1 | 2 | 4 | 32 | 64 | 4096;
            return (x.kind & mask) > 0 && !(x.modifiers & 256);
        };
        this._referenceSymbols = (ref) => {
            return this.symbolStore.findSymbolsByReference(ref, 2);
        };
        this._transformStack = [];
        this._variableTable = new VariableTable();
        this._classStack = [];
        this._symbolTable = this.symbolStore.getSymbolTable(this.doc.uri);
        this._symbols = this._symbolTable.filter(this._symbolFilter);
        this._scopeStack = [reference_1.Scope.create(lsp.Location.create(this.doc.uri, util.cloneRange(this._symbols.shift().location.range)))];
    }
    get refTable() {
        return new reference_1.ReferenceTable(this.doc.uri, this._scopeStack[0]);
    }
    preorder(node, spine) {
        let parent = spine.length ? spine[spine.length - 1] : null;
        let parentTransform = this._transformStack.length ? this._transformStack[this._transformStack.length - 1] : null;
        switch (node.phraseType) {
            case 60:
                this._transformStack.push(null);
                return false;
            case 120:
                {
                    let s = this._symbols.shift();
                    this._scopeStackPush(reference_1.Scope.create(this.doc.nodeLocation(node)));
                    this.nameResolver.namespace = s;
                    this._transformStack.push(new NamespaceDefinitionTransform());
                }
                break;
            case 30:
                this._transformStack.push(new HeaderTransform(this.nameResolver, 1));
                break;
            case 105:
                this._transformStack.push(new HeaderTransform(this.nameResolver, 2));
                break;
            case 167:
                this._transformStack.push(new HeaderTransform(this.nameResolver, 4));
                break;
            case 88:
                this._transformStack.push(new HeaderTransform(this.nameResolver, 64));
                break;
            case 85:
                if (parentTransform) {
                    this._transformStack.push(new FunctionCallExpressionTransform(this._referenceSymbols));
                }
                else {
                    this._transformStack.push(null);
                }
                break;
            case 43:
                this._transformStack.push(new HeaderTransform(this.nameResolver, 8));
                break;
            case 26:
                this._transformStack.push(new MemberDeclarationTransform(1024, this._currentClassName()));
                break;
            case 115:
                this._transformStack.push(new MemberDeclarationTransform(32, this._currentClassName()));
                break;
            case 138:
                this._transformStack.push(new PropertyElementTransform(this._currentClassName()));
                break;
            case 129:
                this._transformStack.push(new ParameterDeclarationTransform());
                break;
            case 124:
                this._transformStack.push(new NamespaceUseDeclarationTransform());
                break;
            case 126:
            case 123:
                this._transformStack.push(new NamespaceUseClauseListTransform(node.phraseType));
                break;
            case 122:
            case 125:
                {
                    if (this._symbols.length && (this._symbols[0].modifiers & 4096) > 0) {
                        this.nameResolver.rules.push(this._symbols.shift());
                    }
                    this._transformStack.push(new NamespaceUseClauseTransform(node.phraseType));
                    break;
                }
            case 86:
                this._transformStack.push(null);
                this._functionDeclaration(node);
                break;
            case 113:
                this._transformStack.push(null);
                this._methodDeclaration(node);
                break;
            case 28:
            case 165:
            case 103:
            case 2:
                {
                    let s = this._symbols.shift() || symbol_1.PhpSymbol.create(1, '', this.doc.nodeHashedLocation(node));
                    this._scopeStackPush(reference_1.Scope.create(this.doc.nodeLocation(node)));
                    this.nameResolver.pushClass(s);
                    this._classStack.push(typeAggregate_1.TypeAggregate.create(this.symbolStore, s.name));
                    this._variableTable.pushScope();
                    this._variableTable.setVariable(Variable.create('$this', s.name));
                    this._transformStack.push(null);
                }
                break;
            case 4:
                this._anonymousFunctionCreationExpression(node);
                this._transformStack.push(null);
                break;
            case 96:
            case 161:
                this._transformStack.push(null);
                this._variableTable.pushBranch();
                break;
            case 17:
            case 48:
            case 53:
            case 52:
                this._transformStack.push(null);
                this._variableTable.popBranch();
                this._variableTable.pushBranch();
                break;
            case 155:
            case 16:
                this._transformStack.push(new SimpleAssignmentExpressionTransform(node.phraseType, this._lastVarTypehints));
                break;
            case 100:
                this._transformStack.push(new InstanceOfExpressionTransform());
                break;
            case 78:
                this._transformStack.push(new ForeachStatementTransform());
                break;
            case 76:
                this._transformStack.push(new ForeachCollectionTransform());
                break;
            case 79:
                this._transformStack.push(new ForeachValueTransform());
                break;
            case 20:
                this._transformStack.push(new CatchClauseTransform());
                break;
            case 22:
                this._transformStack.push(new CatchNameListTransform());
                break;
            case 141:
                this._transformStack.push(new QualifiedNameTransform(this._nameSymbolType(parent), this.doc.nodeLocation(node), this.nameResolver));
                break;
            case 84:
                this._transformStack.push(new FullyQualifiedNameTransform(this._nameSymbolType(parent), this.doc.nodeLocation(node)));
                break;
            case 144:
                this._transformStack.push(new RelativeQualifiedNameTransform(this._nameSymbolType(parent), this.doc.nodeLocation(node), this.nameResolver));
                break;
            case 121:
                this._transformStack.push(new NamespaceNameTransform(node, this.doc));
                break;
            case 156:
                this._transformStack.push(new SimpleVariableTransform(this.doc.nodeLocation(node), this._variableTable));
                break;
            case 108:
                this._transformStack.push(new ListIntrinsicTransform());
                break;
            case 11:
                if (parentTransform) {
                    this._transformStack.push(new ArrayInititialiserListTransform());
                }
                else {
                    this._transformStack.push(null);
                }
                break;
            case 10:
                if (parentTransform) {
                    this._transformStack.push(new ArrayElementTransform());
                }
                else {
                    this._transformStack.push(null);
                }
                break;
            case 13:
                if (parentTransform) {
                    this._transformStack.push(new ArrayValueTransform());
                }
                else {
                    this._transformStack.push(null);
                }
                break;
            case 160:
                if (parentTransform) {
                    this._transformStack.push(new SubscriptExpressionTransform());
                }
                else {
                    this._transformStack.push(null);
                }
                break;
            case 150:
                this._transformStack.push(new MemberAccessExpressionTransform(150, 32, this._referenceSymbols));
                break;
            case 152:
                this._transformStack.push(new MemberAccessExpressionTransform(152, 16, this._referenceSymbols));
                break;
            case 24:
                this._transformStack.push(new MemberAccessExpressionTransform(24, 1024, this._referenceSymbols));
                break;
            case 151:
                this._transformStack.push(new ScopedMemberNameTransform(this.doc.nodeLocation(node)));
                break;
            case 95:
                if (parentTransform) {
                    this._transformStack.push(new IdentifierTransform());
                }
                else {
                    this._transformStack.push(null);
                }
                break;
            case 136:
                this._transformStack.push(new MemberAccessExpressionTransform(136, 16, this._referenceSymbols));
                break;
            case 112:
                this._transformStack.push(new MemberAccessExpressionTransform(112, 32, this._referenceSymbols));
                break;
            case 111:
                this._transformStack.push(new MemberNameTransform(this.doc.nodeLocation(node)));
                break;
            case 7:
                this._transformStack.push(new AnonymousFunctionUseVariableTransform());
                break;
            case 128:
                if (parentTransform) {
                    this._transformStack.push(new ObjectCreationExpressionTransform());
                }
                else {
                    this._transformStack.push(null);
                }
                break;
            case 34:
            case 101:
                if (parentTransform) {
                    this._transformStack.push(new TypeDesignatorTransform(node.phraseType));
                }
                else {
                    this._transformStack.push(null);
                }
                break;
            case 145:
                let context = this._classStack.length ? this._classStack[this._classStack.length - 1] : null;
                let name = context ? context.name : '';
                this._transformStack.push(new RelativeScopeTransform(name, this.doc.nodeLocation(node)));
                break;
            case 40:
                if (parentTransform) {
                    this._transformStack.push(new TernaryExpressionTransform());
                }
                else {
                    this._transformStack.push(null);
                }
                break;
            case 37:
                if (parentTransform) {
                    this._transformStack.push(new CoalesceExpressionTransform());
                }
                else {
                    this._transformStack.push(null);
                }
                break;
            case 56:
                if (parentTransform) {
                    this._transformStack.push(new EncapsulatedExpressionTransform());
                }
                else {
                    this._transformStack.push(null);
                }
                break;
            case undefined:
                if (parentTransform && node.tokenType > 1 && node.tokenType < 85) {
                    parentTransform.push(new TokenTransform(node, this.doc));
                    if (parentTransform.phraseType === 20 && node.tokenType === 84) {
                        this._variableTable.setVariable(parentTransform.variable);
                    }
                }
                else if (node.tokenType === 160) {
                    let phpDoc = phpDoc_1.PhpDocParser.parse(this.doc.tokenText(node));
                    if (phpDoc) {
                        this._lastVarTypehints = phpDoc.varTags;
                        let varTag;
                        for (let n = 0, l = this._lastVarTypehints.length; n < l; ++n) {
                            varTag = this._lastVarTypehints[n];
                            varTag.typeString = typeString_1.TypeString.nameResolve(varTag.typeString, this.nameResolver);
                            this._variableTable.setVariable(Variable.create(varTag.name, varTag.typeString));
                        }
                    }
                }
                else if (node.tokenType === 116 || node.tokenType === 119 || node.tokenType === 88) {
                    this._lastVarTypehints = undefined;
                }
                break;
            default:
                this._transformStack.push(null);
                break;
        }
        return true;
    }
    postorder(node, spine) {
        if (!node.phraseType) {
            return;
        }
        let transform = this._transformStack.pop();
        let parentTransform = this._transformStack.length ? this._transformStack[this._transformStack.length - 1] : null;
        let scope = this._scopeStack.length ? this._scopeStack[this._scopeStack.length - 1] : null;
        if (parentTransform && transform) {
            parentTransform.push(transform);
        }
        switch (node.phraseType) {
            case 84:
            case 141:
            case 144:
            case 156:
            case 150:
            case 24:
            case 152:
            case 136:
            case 112:
            case 122:
            case 125:
            case 30:
            case 105:
            case 167:
            case 88:
            case 43:
            case 138:
            case 26:
            case 115:
            case 120:
            case 129:
            case 7:
            case 145:
                if (scope && transform) {
                    let ref = transform.reference;
                    if (ref) {
                        scope.children.push(ref);
                    }
                }
                if (node.phraseType === 120) {
                    this._scopeStack.pop();
                }
                break;
            case 155:
            case 16:
                this._variableTable.setVariables(transform.variables);
                break;
            case 100:
                this._variableTable.setVariable(transform.variable);
                break;
            case 79:
                this._variableTable.setVariables(parentTransform.variables);
                break;
            case 96:
            case 161:
                this._variableTable.popBranch();
                this._variableTable.pruneBranches();
                break;
            case 28:
            case 165:
            case 103:
            case 2:
                this.nameResolver.popClass();
                this._classStack.pop();
                this._scopeStack.pop();
                this._variableTable.popScope();
                break;
            case 86:
            case 113:
            case 4:
                this._scopeStack.pop();
                this._variableTable.popScope();
                break;
            default:
                break;
        }
    }
    _currentClassName() {
        let c = this._classStack.length ? this._classStack[this._classStack.length - 1] : undefined;
        return c ? c.name : '';
    }
    _scopeStackPush(scope) {
        if (this._scopeStack.length) {
            this._scopeStack[this._scopeStack.length - 1].children.push(scope);
        }
        this._scopeStack.push(scope);
    }
    _nameSymbolType(parent) {
        if (!parent) {
            return 1;
        }
        switch (parent.phraseType) {
            case 41:
                return 8;
            case 85:
                return 64;
            case 34:
                return 2048;
            default:
                return 1;
        }
    }
    _methodDeclaration(node) {
        let scope = reference_1.Scope.create(this.doc.nodeLocation(node));
        this._scopeStackPush(scope);
        this._variableTable.pushScope(['$this']);
        let type = this._classStack.length ? this._classStack[this._classStack.length - 1] : null;
        let symbol = this._symbols.shift();
        if (type && symbol) {
            let lcName = symbol.name.toLowerCase();
            let fn = (x) => {
                return x.kind === 32 && lcName === x.name.toLowerCase();
            };
            symbol = type.members(2, fn).shift();
            let children = symbol && symbol.children ? symbol.children : [];
            let param;
            for (let n = 0, l = children.length; n < l; ++n) {
                param = children[n];
                if (param.kind === 128) {
                    this._variableTable.setVariable(Variable.create(param.name, symbol_1.PhpSymbol.type(param)));
                }
            }
        }
    }
    _functionDeclaration(node) {
        let symbol = this._symbols.shift();
        this._scopeStackPush(reference_1.Scope.create(this.doc.nodeLocation(node)));
        this._variableTable.pushScope();
        let children = symbol && symbol.children ? symbol.children : [];
        let param;
        for (let n = 0, l = children.length; n < l; ++n) {
            param = children[n];
            if (param.kind === 128) {
                this._variableTable.setVariable(Variable.create(param.name, symbol_1.PhpSymbol.type(param)));
            }
        }
    }
    _anonymousFunctionCreationExpression(node) {
        let symbol = this._symbols.shift();
        this._scopeStackPush(reference_1.Scope.create(this.doc.nodeLocation(node)));
        let carry = ['$this'];
        let children = symbol && symbol.children ? symbol.children : [];
        let s;
        for (let n = 0, l = children.length; n < l; ++n) {
            s = children[n];
            if (s.kind === 256 && (s.modifiers & 4096) > 0) {
                carry.push(s.name);
            }
        }
        this._variableTable.pushScope(carry);
        for (let n = 0, l = children.length; n < l; ++n) {
            s = children[n];
            if (s.kind === 128) {
                this._variableTable.setVariable(Variable.create(s.name, symbol_1.PhpSymbol.type(s)));
            }
        }
    }
}
exports.ReferenceReader = ReferenceReader;
class TokenTransform {
    constructor(token, doc) {
        this.token = token;
        this.doc = doc;
    }
    get tokenType() {
        return this.token.tokenType;
    }
    get text() {
        return this.doc.tokenText(this.token);
    }
    get location() {
        return this.doc.nodeLocation(this.token);
    }
    get type() {
        switch (this.token.tokenType) {
            case 79:
                return 'float';
            case 78:
            case 80:
                return 'string';
            case 82:
                return 'int';
            case 83:
                {
                    let lcName = this.text.toLowerCase();
                    return lcName === 'true' || lcName === 'false' ? 'bool' : '';
                }
            default:
                return '';
        }
    }
    push(transform) { }
}
class NamespaceNameTransform {
    constructor(node, document) {
        this.node = node;
        this.document = document;
        this.phraseType = 121;
        this._parts = [];
    }
    get location() {
        return this.document.nodeLocation(this.node);
    }
    push(transform) {
        if (transform.tokenType === 83) {
            this._parts.push(transform.text);
        }
    }
    get text() {
        return this._parts.join('\\');
    }
}
class NamespaceUseClauseListTransform {
    constructor(phraseType) {
        this.phraseType = phraseType;
        this.references = [];
    }
    push(transform) {
        if (transform.phraseType === 122 ||
            transform.phraseType === 125) {
            this.references.push(transform.reference);
        }
    }
}
class NamespaceUseDeclarationTransform {
    constructor() {
        this.phraseType = 124;
        this._kind = 1;
        this._prefix = '';
        this.references = [];
    }
    push(transform) {
        if (transform.tokenType === 12) {
            this._kind = 8;
        }
        else if (transform.tokenType === 35) {
            this._kind = 64;
        }
        else if (transform.phraseType === 121) {
            this._prefix = transform.text;
        }
        else if (transform.phraseType === 126) {
            this.references = transform.references;
            let ref;
            let prefix = this._prefix ? this._prefix + '\\' : '';
            for (let n = 0; n < this.references.length; ++n) {
                ref = this.references[n];
                ref.name = prefix + ref.name;
                if (!ref.kind) {
                    ref.kind = this._kind;
                }
            }
        }
        else if (transform.phraseType === 123) {
            this.references = transform.references;
            let ref;
            for (let n = 0; n < this.references.length; ++n) {
                ref = this.references[n];
                ref.kind = this._kind;
            }
        }
    }
}
class NamespaceUseClauseTransform {
    constructor(phraseType) {
        this.phraseType = phraseType;
        this.reference = reference_1.Reference.create(0, '', null);
    }
    push(transform) {
        if (transform.tokenType === 35) {
            this.reference.kind = 64;
        }
        else if (transform.tokenType === 12) {
            this.reference.kind = 8;
        }
        else if (transform.phraseType === 121) {
            this.reference.name = transform.text;
            this.reference.location = transform.location;
        }
    }
}
class CatchClauseTransform {
    constructor() {
        this.phraseType = 20;
        this._varType = '';
        this._varName = '';
    }
    push(transform) {
        if (transform.phraseType === 22) {
            this._varType = transform.type;
        }
        else if (transform.tokenType === 84) {
            this._varName = transform.text;
        }
    }
    get variable() {
        return this._varName && this._varType ? Variable.create(this._varName, this._varType) : null;
    }
}
class CatchNameListTransform {
    constructor() {
        this.phraseType = 22;
        this.type = '';
    }
    push(transform) {
        let ref = transform.reference;
        if (ref) {
            this.type = typeString_1.TypeString.merge(this.type, ref.name);
        }
    }
}
class AnonymousFunctionUseVariableTransform {
    constructor() {
        this.phraseType = 7;
    }
    push(transform) {
        if (transform.tokenType === 84) {
            this.reference = reference_1.Reference.create(256, transform.text, transform.location);
        }
    }
}
class ForeachStatementTransform {
    constructor() {
        this.phraseType = 78;
        this._type = '';
        this.variables = [];
    }
    push(transform) {
        if (transform.phraseType === 76) {
            this._type = typeString_1.TypeString.arrayDereference(transform.type);
        }
        else if (transform.phraseType === 79) {
            let vars = transform.variables;
            for (let n = 0; n < vars.length; ++n) {
                this.variables.push(Variable.resolveBaseVariable(vars[n], this._type));
            }
        }
    }
}
var Variable;
(function (Variable) {
    function create(name, type) {
        return {
            name: name,
            arrayDereferenced: 0,
            type: type
        };
    }
    Variable.create = create;
    function resolveBaseVariable(variable, type) {
        let deref = variable.arrayDereferenced;
        if (deref > 0) {
            while (deref-- > 0) {
                type = typeString_1.TypeString.arrayReference(type);
            }
        }
        else if (deref < 0) {
            while (deref++ < 0) {
                type = typeString_1.TypeString.arrayDereference(type);
            }
        }
        return Variable.create(variable.name, type);
    }
    Variable.resolveBaseVariable = resolveBaseVariable;
})(Variable || (Variable = {}));
class ForeachValueTransform {
    constructor() {
        this.phraseType = 79;
        this.variables = [];
    }
    push(transform) {
        if (transform.phraseType === 156) {
            let ref = transform.reference;
            this.variables = [{ name: ref.name, arrayDereferenced: 0, type: ref.type }];
        }
        else if (transform.phraseType === 108) {
            this.variables = transform.variables;
        }
    }
}
class ForeachCollectionTransform {
    constructor() {
        this.phraseType = 76;
        this.type = '';
    }
    push(transform) {
        this.type = transform.type || '';
    }
}
class SimpleAssignmentExpressionTransform {
    constructor(phraseType, varTypeOverrides) {
        this.phraseType = phraseType;
        this.varTypeOverrides = varTypeOverrides;
        this.type = '';
        this._pushCount = 0;
        this._variables = [];
    }
    push(transform) {
        ++this._pushCount;
        if (this._pushCount === 1) {
            this._lhs(transform);
        }
        else if (this._pushCount === 2) {
            this.type = transform.type || '';
        }
    }
    _typeOverride(name, tags) {
        if (!tags) {
            return undefined;
        }
        let t;
        for (let n = 0; n < tags.length; ++n) {
            t = tags[n];
            if (name === t.name) {
                return t.typeString;
            }
        }
        return undefined;
    }
    _lhs(lhs) {
        switch (lhs.phraseType) {
            case 156:
                {
                    let ref = lhs.reference;
                    if (ref) {
                        this._variables.push(Variable.create(ref.name, ref.type));
                    }
                    break;
                }
            case 160:
                {
                    let variable = lhs.variable;
                    if (variable) {
                        this._variables.push(variable);
                    }
                    break;
                }
            case 108:
                this._variables = lhs.variables;
                break;
            default:
                break;
        }
    }
    get variables() {
        let type = this.type;
        let tags = this.varTypeOverrides;
        let typeOverrideFn = this._typeOverride;
        let fn = (x) => {
            return Variable.resolveBaseVariable(x, typeOverrideFn(x.name, tags) || type);
        };
        return this._variables.map(fn);
    }
}
class ListIntrinsicTransform {
    constructor() {
        this.phraseType = 108;
        this.variables = [];
    }
    push(transform) {
        if (transform.phraseType !== 11) {
            return;
        }
        this.variables = transform.variables;
        for (let n = 0; n < this.variables.length; ++n) {
            this.variables[n].arrayDereferenced--;
        }
    }
}
class ArrayInititialiserListTransform {
    constructor() {
        this.phraseType = 11;
        this.variables = [];
        this._types = [];
    }
    push(transform) {
        if (transform.phraseType === 10) {
            Array.prototype.push.apply(this.variables, transform.variables);
            this._types.push(transform.type);
        }
    }
    get type() {
        let merged;
        let types;
        if (this._types.length < 4) {
            types = this._types;
        }
        else {
            types = [this._types[0], this._types[Math.floor(this._types.length / 2)], this._types[this._types.length - 1]];
        }
        merged = typeString_1.TypeString.mergeMany(types);
        return typeString_1.TypeString.count(merged) < 3 && merged.indexOf('mixed') < 0 ? merged : 'mixed';
    }
}
class ArrayElementTransform {
    constructor() {
        this.phraseType = 10;
        this.type = '';
        this.variables = [];
    }
    push(transform) {
        if (transform.phraseType === 13) {
            this.variables = transform.variables;
            this.type = transform.type;
        }
    }
}
class ArrayValueTransform {
    constructor() {
        this.phraseType = 13;
        this.type = '';
        this.variables = [];
    }
    push(transform) {
        switch (transform.phraseType) {
            case 156:
                {
                    let ref = transform.reference;
                    this.variables = [{ name: ref.name, arrayDereferenced: 0, type: ref.type || '' }];
                    this.type = ref.type;
                }
                break;
            case 160:
                {
                    let v = transform.variable;
                    if (v) {
                        this.variables = [v];
                    }
                    this.type = transform.type;
                }
                break;
            case 108:
                this.variables = transform.variables;
                break;
            default:
                if (transform.tokenType !== 103) {
                    this.type = transform.type;
                }
                break;
        }
    }
}
class CoalesceExpressionTransform {
    constructor() {
        this.phraseType = 37;
        this.type = '';
    }
    push(transform) {
        this.type = typeString_1.TypeString.merge(this.type, transform.type);
    }
}
class TernaryExpressionTransform {
    constructor() {
        this.phraseType = 40;
        this._transforms = [];
    }
    push(transform) {
        this._transforms.push(transform);
    }
    get type() {
        return this._transforms.slice(-2).reduce((prev, current) => {
            return typeString_1.TypeString.merge(prev, current.type);
        }, '');
    }
}
class SubscriptExpressionTransform {
    constructor() {
        this.phraseType = 160;
        this.type = '';
        this._pushCount = 0;
    }
    push(transform) {
        if (this._pushCount > 0) {
            return;
        }
        ++this._pushCount;
        switch (transform.phraseType) {
            case 156:
                {
                    let ref = transform.reference;
                    if (ref) {
                        this.type = typeString_1.TypeString.arrayDereference(ref.type);
                        this.variable = { name: ref.name, arrayDereferenced: 1, type: this.type };
                    }
                }
                break;
            case 160:
                {
                    let v = transform.variable;
                    this.type = typeString_1.TypeString.arrayDereference(transform.type);
                    if (v) {
                        v.arrayDereferenced++;
                        this.variable = v;
                        this.variable.type = this.type;
                    }
                }
                break;
            case 85:
            case 112:
            case 136:
            case 150:
            case 152:
            case 9:
                this.type = typeString_1.TypeString.arrayDereference(transform.type);
                break;
            default:
                break;
        }
    }
}
class InstanceOfExpressionTransform {
    constructor() {
        this.phraseType = 100;
        this.type = 'bool';
        this._pushCount = 0;
        this._varName = '';
        this._varType = '';
    }
    push(transform) {
        ++this._pushCount;
        if (this._pushCount === 1) {
            if (transform.phraseType === 156) {
                let ref = transform.reference;
                if (ref) {
                    this._varName = ref.name;
                }
            }
        }
        else if (transform.phraseType === 101) {
            this._varType = transform.type;
        }
    }
    get variable() {
        return this._varName && this._varType ? { name: this._varName, arrayDereferenced: 0, type: this._varType } : null;
    }
}
class FunctionCallExpressionTransform {
    constructor(referenceSymbolDelegate) {
        this.referenceSymbolDelegate = referenceSymbolDelegate;
        this.phraseType = 85;
        this.type = '';
    }
    push(transform) {
        switch (transform.phraseType) {
            case 84:
            case 144:
            case 141:
                {
                    let ref = transform.reference;
                    this.type = this.referenceSymbolDelegate(ref).reduce(symbolsToTypeReduceFn, '');
                    break;
                }
            default:
                break;
        }
    }
}
class RelativeScopeTransform {
    constructor(type, loc) {
        this.type = type;
        this.phraseType = 145;
        this.reference = reference_1.Reference.create(1, type, loc);
        this.reference.altName = 'static';
    }
    push(transform) { }
}
class TypeDesignatorTransform {
    constructor(phraseType) {
        this.phraseType = phraseType;
        this.type = '';
    }
    push(transform) {
        switch (transform.phraseType) {
            case 145:
            case 84:
            case 144:
            case 141:
                this.type = transform.type;
                break;
            default:
                break;
        }
    }
}
class AnonymousClassDeclarationTransform {
    constructor(type) {
        this.type = type;
        this.phraseType = 2;
    }
    push(transform) { }
}
class ObjectCreationExpressionTransform {
    constructor() {
        this.phraseType = 128;
        this.type = '';
    }
    push(transform) {
        if (transform.phraseType === 34 ||
            transform.phraseType === 2) {
            this.type = transform.type;
        }
    }
}
class SimpleVariableTransform {
    constructor(loc, varTable) {
        this.phraseType = 156;
        this._varTable = varTable;
        this.reference = reference_1.Reference.create(256, '', loc);
    }
    push(transform) {
        if (transform.tokenType === 84) {
            this.reference.name = transform.text;
            this.reference.type = this._varTable.getType(this.reference.name);
        }
    }
    get type() {
        return this.reference.type;
    }
}
class FullyQualifiedNameTransform {
    constructor(symbolKind, loc) {
        this.phraseType = 84;
        this.reference = reference_1.Reference.create(symbolKind, '', loc);
    }
    push(transform) {
        if (transform.phraseType === 121) {
            this.reference.name = transform.text;
        }
    }
    get type() {
        return this.reference.name;
    }
}
class QualifiedNameTransform {
    constructor(symbolKind, loc, nameResolver) {
        this.phraseType = 141;
        this.reference = reference_1.Reference.create(symbolKind, '', loc);
        this._nameResolver = nameResolver;
    }
    push(transform) {
        if (transform.phraseType === 121) {
            let name = transform.text;
            let lcName = name.toLowerCase();
            this.reference.name = this._nameResolver.resolveNotFullyQualified(name, this.reference.kind);
            if (((this.reference.kind === 64 || this.reference.kind === 8) &&
                name !== this.reference.name && name.indexOf('\\') < 0) || (lcName === 'parent' || lcName === 'self')) {
                this.reference.altName = name;
            }
        }
    }
    get type() {
        return this.reference.name;
    }
}
class RelativeQualifiedNameTransform {
    constructor(symbolKind, loc, nameResolver) {
        this.phraseType = 144;
        this.reference = reference_1.Reference.create(symbolKind, '', loc);
        this._nameResolver = nameResolver;
    }
    push(transform) {
        if (transform.phraseType === 121) {
            this.reference.name = this._nameResolver.resolveRelative(transform.text);
        }
    }
    get type() {
        return this.reference.name;
    }
}
class MemberNameTransform {
    constructor(loc) {
        this.phraseType = 111;
        this.reference = reference_1.Reference.create(0, '', loc);
    }
    push(transform) {
        if (transform.tokenType === 83) {
            this.reference.name = transform.text;
        }
    }
}
class ScopedMemberNameTransform {
    constructor(loc) {
        this.phraseType = 151;
        this.reference = reference_1.Reference.create(0, '', loc);
    }
    push(transform) {
        if (transform.tokenType === 84 ||
            transform.phraseType === 95) {
            this.reference.name = transform.text;
        }
    }
}
class IdentifierTransform {
    constructor() {
        this.phraseType = 95;
        this.text = '';
    }
    push(transform) {
        this.text = transform.text;
        this.location = transform.location;
    }
}
class MemberAccessExpressionTransform {
    constructor(phraseType, symbolKind, referenceSymbolDelegate) {
        this.phraseType = phraseType;
        this.symbolKind = symbolKind;
        this.referenceSymbolDelegate = referenceSymbolDelegate;
        this._scope = '';
    }
    push(transform) {
        switch (transform.phraseType) {
            case 151:
            case 111:
                this.reference = transform.reference;
                this.reference.kind = this.symbolKind;
                this.reference.scope = this._scope;
                if (this.symbolKind === 16 && this.reference.name && this.reference.name[0] !== '$') {
                    this.reference.name = '$' + this.reference.name;
                }
                break;
            case 150:
            case 112:
            case 136:
            case 152:
            case 85:
            case 160:
            case 156:
            case 84:
            case 141:
            case 144:
            case 56:
            case 145:
                this._scope = transform.type;
                break;
            default:
                break;
        }
    }
    get type() {
        return this.referenceSymbolDelegate(this.reference).reduce(symbolsToTypeReduceFn, '');
    }
}
class HeaderTransform {
    constructor(nameResolver, kind) {
        this.nameResolver = nameResolver;
        this._kind = kind;
    }
    push(transform) {
        if (transform.tokenType === 83) {
            let name = transform.text;
            let loc = transform.location;
            this.reference = reference_1.Reference.create(this._kind, this.nameResolver.resolveRelative(name), loc);
        }
    }
}
class MemberDeclarationTransform {
    constructor(kind, scope) {
        this._scope = '';
        this._kind = kind;
        this._scope = scope;
    }
    push(transform) {
        if (transform.phraseType === 95) {
            let name = transform.text;
            let loc = transform.location;
            this.reference = reference_1.Reference.create(this._kind, name, loc);
            this.reference.scope = this._scope;
        }
    }
}
class PropertyElementTransform {
    constructor(scope) {
        this._scope = '';
        this._scope = scope;
    }
    push(transform) {
        if (transform.tokenType === 84) {
            let name = transform.text;
            let loc = transform.location;
            this.reference = reference_1.Reference.create(16, name, loc);
            this.reference.scope = this._scope;
        }
    }
}
class NamespaceDefinitionTransform {
    push(transform) {
        if (transform.phraseType === 121) {
            this.reference = reference_1.Reference.create(512, transform.text, transform.location);
        }
    }
}
class ParameterDeclarationTransform {
    push(transform) {
        if (transform.tokenType === 84) {
            this.reference = reference_1.Reference.create(128, transform.text, transform.location);
        }
    }
}
class EncapsulatedExpressionTransform {
    constructor() {
        this.phraseType = 56;
    }
    push(transform) {
        if (transform.phraseType || (transform.tokenType >= 71 && transform.tokenType <= 82)) {
            this._transform = transform;
        }
    }
    get reference() {
        return this._transform ? this._transform.reference : undefined;
    }
    get type() {
        return this._transform ? this._transform.type : undefined;
    }
}
class VariableTable {
    constructor() {
        this._typeVariableSetStack = [VariableSet.create(1)];
    }
    setVariable(v) {
        if (!v || !v.name || !v.type) {
            return;
        }
        this._typeVariableSetStack[this._typeVariableSetStack.length - 1].variables[v.name] = v;
    }
    setVariables(vars) {
        if (!vars) {
            return;
        }
        for (let n = 0; n < vars.length; ++n) {
            this.setVariable(vars[n]);
        }
    }
    pushScope(carry) {
        let scope = VariableSet.create(1);
        if (carry) {
            let type;
            let name;
            for (let n = 0; n < carry.length; ++n) {
                name = carry[n];
                type = this.getType(name);
                if (type && name) {
                    scope.variables[name] = Variable.create(name, type);
                }
            }
        }
        this._typeVariableSetStack.push(scope);
    }
    popScope() {
        this._typeVariableSetStack.pop();
    }
    pushBranch() {
        let b = VariableSet.create(3);
        this._typeVariableSetStack[this._typeVariableSetStack.length - 1].branches.push(b);
        this._typeVariableSetStack.push(b);
    }
    popBranch() {
        this._typeVariableSetStack.pop();
    }
    pruneBranches() {
        let node = this._typeVariableSetStack[this._typeVariableSetStack.length - 1];
        let branches = node.branches;
        node.branches = [];
        for (let n = 0, l = branches.length; n < l; ++n) {
            this._mergeSets(node, branches[n]);
        }
    }
    getType(varName) {
        let typeSet;
        for (let n = this._typeVariableSetStack.length - 1; n >= 0; --n) {
            typeSet = this._typeVariableSetStack[n];
            if (typeSet.variables[varName]) {
                return typeSet.variables[varName].type;
            }
            if (typeSet.kind === 1) {
                break;
            }
        }
        return '';
    }
    _mergeSets(a, b) {
        let keys = Object.keys(b.variables);
        let v;
        for (let n = 0, l = keys.length; n < l; ++n) {
            v = b.variables[keys[n]];
            if (a.variables[v.name]) {
                a.variables[v.name].type = typeString_1.TypeString.merge(a.variables[v.name].type, v.type);
            }
            else {
                a.variables[v.name] = v;
            }
        }
    }
}
var VariableSet;
(function (VariableSet) {
    function create(kind) {
        return {
            kind: kind,
            variables: {},
            branches: []
        };
    }
    VariableSet.create = create;
})(VariableSet || (VariableSet = {}));
(function (ReferenceReader) {
    function discoverReferences(doc, symbolStore) {
        let visitor = new ReferenceReader(doc, new nameResolver_1.NameResolver(), symbolStore);
        doc.traverse(visitor);
        return visitor.refTable;
    }
    ReferenceReader.discoverReferences = discoverReferences;
})(ReferenceReader = exports.ReferenceReader || (exports.ReferenceReader = {}));
