/* Copyright (c) Ben Robert Mewburn
 * Licensed under the ISC Licence.
 */

'use strict';

import {
    TreeVisitor, MultiVisitor
} from './types';
import { Phrase, Token, PhraseType, TokenType } from 'php7parser';
import { SymbolKind, PhpSymbol, SymbolModifier } from './symbol';
import { SymbolStore, SymbolTable } from './symbolStore';
import { ParsedDocument, NodeTransform } from './parsedDocument';
import { NameResolver } from './nameResolver';
import { Predicate, BinarySearch, BinarySearchResult } from './types';
import * as lsp from 'vscode-languageserver-types';
import { isInRange } from './util';
import { TypeString } from './typeString';
import { TypeAggregate, MemberMergeStrategy } from './typeAggregate';
import * as util from './util';
import { PhpDocParser, Tag } from './phpDoc';
import { Reference, Scope, ReferenceTable } from './reference';

interface TypeNodeTransform extends NodeTransform {
    type: string;
}

interface ReferenceNodeTransform extends NodeTransform {
    reference: Reference;
}

interface VariableNodeTransform extends NodeTransform {
    variable: Variable;
}

interface TextNodeTransform extends NodeTransform {
    text: string;
}

function symbolsToTypeReduceFn(prev: string, current: PhpSymbol, index: number, array: PhpSymbol[]) {
    return TypeString.merge(prev, PhpSymbol.type(current));
}

export class ReferenceReader implements TreeVisitor<Phrase | Token> {

    private _transformStack: NodeTransform[];
    private _variableTable: VariableTable;
    private _classStack: TypeAggregate[];
    private _scopeStack: Scope[];
    private _symbols: PhpSymbol[];
    private _symbolFilter: Predicate<PhpSymbol> = (x) => {
        const mask = SymbolKind.Namespace | SymbolKind.Class | SymbolKind.Interface | SymbolKind.Trait | SymbolKind.Method | SymbolKind.Function | SymbolKind.File;
        return (x.kind & mask) > 0 && !(x.modifiers & SymbolModifier.Magic);
    };
    private _lastVarTypehints: Tag[];
    private _symbolTable: SymbolTable;

    constructor(
        public doc: ParsedDocument,
        public nameResolver: NameResolver,
        public symbolStore: SymbolStore,
    ) {
        this._transformStack = [];
        this._variableTable = new VariableTable();
        this._classStack = [];
        this._symbolTable = this.symbolStore.getSymbolTable(this.doc.uri);
        this._symbols = this._symbolTable.filter(this._symbolFilter);
        this._scopeStack = [Scope.create(lsp.Location.create(this.doc.uri, util.cloneRange(this._symbols.shift().location.range)))]; //file/root node
    }

    get refTable() {
        return new ReferenceTable(this.doc.uri, this._scopeStack[0]);
    }

    preorder(node: Phrase | Token, spine: (Phrase | Token)[]) {

        let parent = spine.length ? spine[spine.length - 1] : null;
        let parentTransform = this._transformStack.length ? this._transformStack[this._transformStack.length - 1] : null;

        switch ((<Phrase>node).phraseType) {

            case PhraseType.Error:
                this._transformStack.push(null);
                return false;

            case PhraseType.NamespaceDefinition:
                {
                    let s = this._symbols.shift();
                    this._scopeStackPush(Scope.create(this.doc.nodeLocation(node)));
                    this.nameResolver.namespace = s;
                    this._transformStack.push(new NamespaceDefinitionTransform());
                }
                break;

            case PhraseType.ClassDeclarationHeader:
                this._transformStack.push(new HeaderTransform(this.nameResolver, SymbolKind.Class));
                break;

            case PhraseType.InterfaceDeclarationHeader:
                this._transformStack.push(new HeaderTransform(this.nameResolver, SymbolKind.Interface));
                break;

            case PhraseType.TraitDeclarationHeader:
                this._transformStack.push(new HeaderTransform(this.nameResolver, SymbolKind.Trait));
                break;

            case PhraseType.FunctionDeclarationHeader:
                this._transformStack.push(new HeaderTransform(this.nameResolver, SymbolKind.Function));
                break;

            case PhraseType.FunctionCallExpression:
                //todo define
                if (parentTransform) {
                    this._transformStack.push(new FunctionCallExpressionTransform(this._referenceSymbols));
                } else {
                    this._transformStack.push(null);
                }
                break;

            case PhraseType.ConstElement:
                this._transformStack.push(new HeaderTransform(this.nameResolver, SymbolKind.Constant));
                break;

            case PhraseType.ClassConstElement:
                this._transformStack.push(new MemberDeclarationTransform(SymbolKind.ClassConstant, this._currentClassName()));
                break;

            case PhraseType.MethodDeclarationHeader:
                this._transformStack.push(new MemberDeclarationTransform(SymbolKind.Method, this._currentClassName()));
                break;

            case PhraseType.PropertyElement:
                this._transformStack.push(new PropertyElementTransform(this._currentClassName()));
                break;

            case PhraseType.ParameterDeclaration:
                this._transformStack.push(new ParameterDeclarationTransform());
                break;

            case PhraseType.NamespaceUseDeclaration:
                this._transformStack.push(new NamespaceUseDeclarationTransform());
                break;

            case PhraseType.NamespaceUseGroupClauseList:
            case PhraseType.NamespaceUseClauseList:
                this._transformStack.push(new NamespaceUseClauseListTransform((<Phrase>node).phraseType));
                break;

            case PhraseType.NamespaceUseClause:
            case PhraseType.NamespaceUseGroupClause:
                {
                    if(this._symbols.length && (this._symbols[0].modifiers & SymbolModifier.Use) > 0) {
                        this.nameResolver.rules.push(this._symbols.shift());
                    }
                    this._transformStack.push(new NamespaceUseClauseTransform((<Phrase>node).phraseType));
                    break;
                }

            case PhraseType.FunctionDeclaration:
                this._transformStack.push(null);
                this._functionDeclaration(<Phrase>node);
                break;

            case PhraseType.MethodDeclaration:
                this._transformStack.push(null);
                this._methodDeclaration(<Phrase>node);
                break;

            case PhraseType.ClassDeclaration:
            case PhraseType.TraitDeclaration:
            case PhraseType.InterfaceDeclaration:
            case PhraseType.AnonymousClassDeclaration:
                {
                    let s = this._symbols.shift() || PhpSymbol.create(SymbolKind.Class, '', this.doc.nodeHashedLocation(<Phrase>node));
                    this._scopeStackPush(Scope.create(this.doc.nodeLocation(<Phrase>node)));
                    this.nameResolver.pushClass(s);
                    this._classStack.push(TypeAggregate.create(this.symbolStore, s.name));
                    this._variableTable.pushScope();
                    this._variableTable.setVariable(Variable.create('$this', s.name));
                    this._transformStack.push(null);
                }
                break;

            case PhraseType.AnonymousFunctionCreationExpression:
                this._anonymousFunctionCreationExpression(<Phrase>node);
                this._transformStack.push(null);
                break;

            case PhraseType.IfStatement:
            case PhraseType.SwitchStatement:
                this._transformStack.push(null);
                this._variableTable.pushBranch();
                break;

            case PhraseType.CaseStatement:
            case PhraseType.DefaultStatement:
            case PhraseType.ElseIfClause:
            case PhraseType.ElseClause:
                this._transformStack.push(null);
                this._variableTable.popBranch();
                this._variableTable.pushBranch();
                break;

            case PhraseType.SimpleAssignmentExpression:
            case PhraseType.ByRefAssignmentExpression:
                this._transformStack.push(new SimpleAssignmentExpressionTransform((<Phrase>node).phraseType, this._lastVarTypehints));
                break;

            case PhraseType.InstanceOfExpression:
                this._transformStack.push(new InstanceOfExpressionTransform());
                break;

            case PhraseType.ForeachStatement:
                this._transformStack.push(new ForeachStatementTransform());
                break;

            case PhraseType.ForeachCollection:
                this._transformStack.push(new ForeachCollectionTransform());
                break;

            case PhraseType.ForeachValue:
                this._transformStack.push(new ForeachValueTransform());
                break;

            case PhraseType.CatchClause:
                this._transformStack.push(new CatchClauseTransform());
                break;

            case PhraseType.CatchNameList:
                this._transformStack.push(new CatchNameListTransform());
                break;

            case PhraseType.QualifiedName:
                this._transformStack.push(
                    new QualifiedNameTransform(this._nameSymbolType(<Phrase>parent), this.doc.nodeLocation(node), this.nameResolver)
                );
                break;

            case PhraseType.FullyQualifiedName:
                this._transformStack.push(
                    new FullyQualifiedNameTransform(this._nameSymbolType(<Phrase>parent), this.doc.nodeLocation(node))
                );
                break;

            case PhraseType.RelativeQualifiedName:
                this._transformStack.push(
                    new RelativeQualifiedNameTransform(this._nameSymbolType(<Phrase>parent), this.doc.nodeLocation(node), this.nameResolver)
                );
                break;

            case PhraseType.NamespaceName:
                this._transformStack.push(new NamespaceNameTransform(<Phrase>node, this.doc));
                break;

            case PhraseType.SimpleVariable:
                this._transformStack.push(new SimpleVariableTransform(this.doc.nodeLocation(node), this._variableTable));
                break;

            case PhraseType.ListIntrinsic:
                this._transformStack.push(new ListIntrinsicTransform());
                break;

            case PhraseType.ArrayInitialiserList:
                if (parentTransform) {
                    this._transformStack.push(new ArrayInititialiserListTransform());
                } else {
                    this._transformStack.push(null);
                }
                break;

            case PhraseType.ArrayElement:
                if (parentTransform) {
                    this._transformStack.push(new ArrayElementTransform());
                } else {
                    this._transformStack.push(null);
                }
                break;

            case PhraseType.ArrayValue:
                if (parentTransform) {
                    this._transformStack.push(new ArrayValueTransform());
                } else {
                    this._transformStack.push(null);
                }
                break;

            case PhraseType.SubscriptExpression:
                if (parentTransform) {
                    this._transformStack.push(new SubscriptExpressionTransform());
                } else {
                    this._transformStack.push(null);
                }
                break;

            case PhraseType.ScopedCallExpression:
                this._transformStack.push(
                    new MemberAccessExpressionTransform(PhraseType.ScopedCallExpression, SymbolKind.Method, this._referenceSymbols)
                );
                break;

            case PhraseType.ScopedPropertyAccessExpression:
                this._transformStack.push(
                    new MemberAccessExpressionTransform(PhraseType.ScopedPropertyAccessExpression, SymbolKind.Property, this._referenceSymbols)
                );
                break;

            case PhraseType.ClassConstantAccessExpression:
                this._transformStack.push(
                    new MemberAccessExpressionTransform(PhraseType.ClassConstantAccessExpression, SymbolKind.ClassConstant, this._referenceSymbols)
                );
                break;

            case PhraseType.ScopedMemberName:
                this._transformStack.push(new ScopedMemberNameTransform(this.doc.nodeLocation(node)));
                break;

            case PhraseType.Identifier:
                if (parentTransform) {
                    this._transformStack.push(new IdentifierTransform());
                } else {
                    this._transformStack.push(null);
                }
                break;

            case PhraseType.PropertyAccessExpression:
                this._transformStack.push(
                    new MemberAccessExpressionTransform(PhraseType.PropertyAccessExpression, SymbolKind.Property, this._referenceSymbols)
                );
                break;

            case PhraseType.MethodCallExpression:
                this._transformStack.push(
                    new MemberAccessExpressionTransform(PhraseType.MethodCallExpression, SymbolKind.Method, this._referenceSymbols)
                );
                break;

            case PhraseType.MemberName:
                this._transformStack.push(new MemberNameTransform(this.doc.nodeLocation(node)));
                break;

            case PhraseType.AnonymousFunctionUseVariable:
                this._transformStack.push(new AnonymousFunctionUseVariableTransform());
                break;

            case PhraseType.ObjectCreationExpression:
                if (parentTransform) {
                    this._transformStack.push(new ObjectCreationExpressionTransform());
                } else {
                    this._transformStack.push(null);
                }
                break;

            case PhraseType.ClassTypeDesignator:
            case PhraseType.InstanceofTypeDesignator:
                if (parentTransform) {
                    this._transformStack.push(new TypeDesignatorTransform((<Phrase>node).phraseType));
                } else {
                    this._transformStack.push(null);
                }
                break;

            case PhraseType.RelativeScope:
                let context = this._classStack.length ? this._classStack[this._classStack.length - 1] : null;
                let name = context ? context.name : '';
                this._transformStack.push(new RelativeScopeTransform(name, this.doc.nodeLocation(node)));
                break;

            case PhraseType.TernaryExpression:
                if (parentTransform) {
                    this._transformStack.push(new TernaryExpressionTransform());
                } else {
                    this._transformStack.push(null);
                }
                break;

            case PhraseType.CoalesceExpression:
                if (parentTransform) {
                    this._transformStack.push(new CoalesceExpressionTransform());
                } else {
                    this._transformStack.push(null);
                }
                break;

            case PhraseType.EncapsulatedExpression:
                if (parentTransform) {
                    this._transformStack.push(new EncapsulatedExpressionTransform());
                } else {
                    this._transformStack.push(null);
                }
                break;

            case undefined:
                //tokens
                if (parentTransform && (<Token>node).tokenType > TokenType.EndOfFile && (<Token>node).tokenType < TokenType.Equals) {
                    parentTransform.push(new TokenTransform(<Token>node, this.doc));
                    if (parentTransform.phraseType === PhraseType.CatchClause && (<Token>node).tokenType === TokenType.VariableName) {
                        this._variableTable.setVariable((<CatchClauseTransform>parentTransform).variable);
                    }
                } else if ((<Token>node).tokenType === TokenType.DocumentComment) {
                    let phpDoc = PhpDocParser.parse(this.doc.tokenText(<Token>node));
                    if (phpDoc) {
                        this._lastVarTypehints = phpDoc.varTags;
                        let varTag: Tag;
                        for (let n = 0, l = this._lastVarTypehints.length; n < l; ++n) {
                            varTag = this._lastVarTypehints[n];
                            varTag.typeString = TypeString.nameResolve(varTag.typeString, this.nameResolver);
                            this._variableTable.setVariable(Variable.create(varTag.name, varTag.typeString));
                        }
                    }
                } else if ((<Token>node).tokenType === TokenType.OpenBrace || (<Token>node).tokenType === TokenType.CloseBrace || (<Token>node).tokenType === TokenType.Semicolon) {
                    this._lastVarTypehints = undefined;
                }
                break;

            default:
                this._transformStack.push(null);
                break;
        }

        return true;

    }

    postorder(node: Phrase | Token, spine: (Phrase | Token)[]) {

        if (!(<Phrase>node).phraseType) {
            return;
        }

        let transform = this._transformStack.pop();
        let parentTransform = this._transformStack.length ? this._transformStack[this._transformStack.length - 1] : null;
        let scope = this._scopeStack.length ? this._scopeStack[this._scopeStack.length - 1] : null;

        if (parentTransform && transform) {
            parentTransform.push(transform);
        }

        switch ((<Phrase>node).phraseType) {

            case PhraseType.FullyQualifiedName:
            case PhraseType.QualifiedName:
            case PhraseType.RelativeQualifiedName:
            case PhraseType.SimpleVariable:
            case PhraseType.ScopedCallExpression:
            case PhraseType.ClassConstantAccessExpression:
            case PhraseType.ScopedPropertyAccessExpression:
            case PhraseType.PropertyAccessExpression:
            case PhraseType.MethodCallExpression:
            case PhraseType.NamespaceUseClause:
            case PhraseType.NamespaceUseGroupClause:
            case PhraseType.ClassDeclarationHeader:
            case PhraseType.InterfaceDeclarationHeader:
            case PhraseType.TraitDeclarationHeader:
            case PhraseType.FunctionDeclarationHeader:
            case PhraseType.ConstElement:
            case PhraseType.PropertyElement:
            case PhraseType.ClassConstElement:
            case PhraseType.MethodDeclarationHeader:
            case PhraseType.NamespaceDefinition:
            case PhraseType.ParameterDeclaration:
            case PhraseType.AnonymousFunctionUseVariable:
            case PhraseType.RelativeScope:
                if (scope && transform) {
                    let ref = (<ReferenceNodeTransform>transform).reference;

                    if (ref) {
                        scope.children.push(ref);
                    }
                }

                if ((<Phrase>node).phraseType === PhraseType.NamespaceDefinition) {
                    this._scopeStack.pop();
                }
                break;

            case PhraseType.SimpleAssignmentExpression:
            case PhraseType.ByRefAssignmentExpression:
                this._variableTable.setVariables((<SimpleAssignmentExpressionTransform>transform).variables);
                break;

            case PhraseType.InstanceOfExpression:
                this._variableTable.setVariable((<InstanceOfExpressionTransform>transform).variable);
                break;

            case PhraseType.ForeachValue:
                this._variableTable.setVariables((<ForeachStatementTransform>parentTransform).variables);
                break;

            case PhraseType.IfStatement:
            case PhraseType.SwitchStatement:
                this._variableTable.popBranch();
                this._variableTable.pruneBranches();
                break;

            case PhraseType.ClassDeclaration:
            case PhraseType.TraitDeclaration:
            case PhraseType.InterfaceDeclaration:
            case PhraseType.AnonymousClassDeclaration:
                this.nameResolver.popClass();
                this._classStack.pop();
                this._scopeStack.pop();
                this._variableTable.popScope();
                break;

            case PhraseType.FunctionDeclaration:
            case PhraseType.MethodDeclaration:
            case PhraseType.AnonymousFunctionCreationExpression:
                this._scopeStack.pop();
                this._variableTable.popScope();
                break;

            default:
                break;
        }

    }

    private _currentClassName() {
        let c = this._classStack.length ? this._classStack[this._classStack.length - 1] : undefined;
        return c ? c.name : '';
    }

    private _scopeStackPush(scope: Scope) {
        if (this._scopeStack.length) {
            this._scopeStack[this._scopeStack.length - 1].children.push(scope);
        }
        this._scopeStack.push(scope);
    }

    private _nameSymbolType(parent: Phrase) {
        if (!parent) {
            return SymbolKind.Class;
        }

        switch (parent.phraseType) {
            case PhraseType.ConstantAccessExpression:
                return SymbolKind.Constant;
            case PhraseType.FunctionCallExpression:
                return SymbolKind.Function;
            case PhraseType.ClassTypeDesignator:
                return SymbolKind.Constructor;
            default:
                return SymbolKind.Class;
        }
    }

    private _methodDeclaration(node: Phrase) {

        let scope = Scope.create(this.doc.nodeLocation(node));
        this._scopeStackPush(scope);
        this._variableTable.pushScope(['$this']);
        let type = this._classStack.length ? this._classStack[this._classStack.length - 1] : null;
        let symbol = this._symbols.shift();

        if (type && symbol) {
            let lcName = symbol.name.toLowerCase();
            let fn = (x: PhpSymbol) => {
                return x.kind === SymbolKind.Method && lcName === x.name.toLowerCase();
            };
            //lookup method on aggregate to inherit doc
            symbol = type.members(MemberMergeStrategy.Documented, fn).shift();
            let children = symbol && symbol.children ? symbol.children : [];
            let param: PhpSymbol;
            for (let n = 0, l = children.length; n < l; ++n) {
                param = children[n];
                if (param.kind === SymbolKind.Parameter) {
                    this._variableTable.setVariable(Variable.create(param.name, PhpSymbol.type(param)));
                }
            }
        }
    }

    private _functionDeclaration(node: Phrase) {
        let symbol = this._symbols.shift();
        this._scopeStackPush(Scope.create(this.doc.nodeLocation(node)));
        this._variableTable.pushScope();

        let children = symbol && symbol.children ? symbol.children : [];
        let param: PhpSymbol;
        for (let n = 0, l = children.length; n < l; ++n) {
            param = children[n];
            if (param.kind === SymbolKind.Parameter) {
                this._variableTable.setVariable(Variable.create(param.name, PhpSymbol.type(param)));
            }
        }
    }

    private _anonymousFunctionCreationExpression(node: Phrase) {
        let symbol = this._symbols.shift();
        this._scopeStackPush(Scope.create(this.doc.nodeLocation(node)));
        let carry: string[] = ['$this'];
        let children = symbol && symbol.children ? symbol.children : [];
        let s: PhpSymbol;

        for (let n = 0, l = children.length; n < l; ++n) {
            s = children[n];
            if (s.kind === SymbolKind.Variable && (s.modifiers & SymbolModifier.Use) > 0) {
                carry.push(s.name);
            }
        }

        this._variableTable.pushScope(carry);

        for (let n = 0, l = children.length; n < l; ++n) {
            s = children[n];
            if (s.kind === SymbolKind.Parameter) {
                this._variableTable.setVariable(Variable.create(s.name, PhpSymbol.type(s)));
            }
        }

    }

    private _referenceSymbols: ReferenceSymbolDelegate = (ref) => {
        return this.symbolStore.findSymbolsByReference(ref, MemberMergeStrategy.Documented);
    }

}

class TokenTransform implements TypeNodeTransform, TextNodeTransform {

    constructor(public token: Token, public doc: ParsedDocument) { }

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
            case TokenType.FloatingLiteral:
                return 'float';
            case TokenType.StringLiteral:
            case TokenType.EncapsulatedAndWhitespace:
                return 'string';
            case TokenType.IntegerLiteral:
                return 'int';
            case TokenType.Name:
                {
                    let lcName = this.text.toLowerCase();
                    return lcName === 'true' || lcName === 'false' ? 'bool' : '';
                }
            default:
                return '';
        }
    }

    push(transform: NodeTransform) { }

}

class NamespaceNameTransform implements NodeTransform {

    phraseType = PhraseType.NamespaceName;
    private _parts: string[];

    constructor(public node: Phrase, public document: ParsedDocument) {
        this._parts = [];
    }

    get location() {
        return this.document.nodeLocation(this.node);
    }

    push(transform: NodeTransform) {
        if (transform.tokenType === TokenType.Name) {
            this._parts.push((<TokenTransform>transform).text);
        }
    }

    get text() {
        return this._parts.join('\\');
    }

}

class NamespaceUseClauseListTransform implements NodeTransform {

    references: Reference[];

    constructor(public phraseType: PhraseType) {
        this.references = [];
    }

    push(transform: NodeTransform) {
        if (
            transform.phraseType === PhraseType.NamespaceUseClause ||
            transform.phraseType === PhraseType.NamespaceUseGroupClause
        ) {
            this.references.push((<ReferenceNodeTransform>transform).reference);
        }
    }

}

class NamespaceUseDeclarationTransform implements NodeTransform {

    phraseType = PhraseType.NamespaceUseDeclaration;
    references: Reference[];
    private _kind = SymbolKind.Class;
    private _prefix = '';

    constructor() {
        this.references = [];
    }

    push(transform: NodeTransform) {
        if (transform.tokenType === TokenType.Const) {
            this._kind = SymbolKind.Constant;
        } else if (transform.tokenType === TokenType.Function) {
            this._kind = SymbolKind.Function;
        } else if (transform.phraseType === PhraseType.NamespaceName) {
            this._prefix = (<NamespaceNameTransform>transform).text;
        } else if (transform.phraseType === PhraseType.NamespaceUseGroupClauseList) {
            this.references = (<NamespaceUseClauseListTransform>transform).references;
            let ref: Reference;
            let prefix = this._prefix ? this._prefix + '\\' : '';
            for (let n = 0; n < this.references.length; ++n) {
                ref = this.references[n];
                ref.name = prefix + ref.name;
                if (!ref.kind) {
                    ref.kind = this._kind;
                }
            }
        } else if (transform.phraseType === PhraseType.NamespaceUseClauseList) {
            this.references = (<NamespaceUseClauseListTransform>transform).references;
            let ref: Reference;
            for (let n = 0; n < this.references.length; ++n) {
                ref = this.references[n];
                ref.kind = this._kind;
            }
        }
    }

}

class NamespaceUseClauseTransform implements ReferenceNodeTransform {

    reference: Reference;

    constructor(public phraseType: PhraseType) {
        this.reference = Reference.create(0, '', null);
    }

    push(transform: NodeTransform) {
        if (transform.tokenType === TokenType.Function) {
            this.reference.kind = SymbolKind.Function;
        } else if (transform.tokenType === TokenType.Const) {
            this.reference.kind = SymbolKind.Constant;
        } else if (transform.phraseType === PhraseType.NamespaceName) {
            this.reference.name = (<NamespaceNameTransform>transform).text;
            this.reference.location = (<NamespaceNameTransform>transform).location;
        }
    }

}

type ReferenceSymbolDelegate = (ref: Reference) => PhpSymbol[];

class CatchClauseTransform implements VariableNodeTransform {

    phraseType = PhraseType.CatchClause;
    private _varType = '';
    private _varName = '';

    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.CatchNameList) {
            this._varType = (<CatchNameListTransform>transform).type;
        } else if (transform.tokenType === TokenType.VariableName) {
            this._varName = (<TokenTransform>transform).text;
        }
    }

    get variable() {
        return this._varName && this._varType ? Variable.create(this._varName, this._varType) : null;
    }

}

class CatchNameListTransform implements TypeNodeTransform {

    phraseType = PhraseType.CatchNameList;
    type = '';

    push(transform: NodeTransform) {
        let ref = (<ReferenceNodeTransform>transform).reference;
        if (ref) {
            this.type = TypeString.merge(this.type, ref.name);
        }
    }

}

class AnonymousFunctionUseVariableTransform implements ReferenceNodeTransform {
    phraseType = PhraseType.AnonymousFunctionUseVariable;
    reference: Reference;

    push(transform: NodeTransform) {
        if (transform.tokenType === TokenType.VariableName) {
            this.reference = Reference.create(SymbolKind.Variable, (<TokenTransform>transform).text, (<TokenTransform>transform).location);
        }
    }
}

class ForeachStatementTransform implements NodeTransform {

    phraseType = PhraseType.ForeachStatement;
    variables: Variable[];
    private _type = '';

    constructor() {
        this.variables = [];
    }

    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.ForeachCollection) {
            this._type = TypeString.arrayDereference((<ForeachCollectionTransform>transform).type);
        } else if (transform.phraseType === PhraseType.ForeachValue) {
            let vars = (<ForeachValueTransform>transform).variables;
            for (let n = 0; n < vars.length; ++n) {
                this.variables.push(Variable.resolveBaseVariable(vars[n], this._type));
            }
        }
    }

}

interface Variable {
    name: string;
    arrayDereferenced: number;
    type: string;
}

namespace Variable {

    export function create(name: string, type: string) {
        return <Variable>{
            name: name,
            arrayDereferenced: 0,
            type: type
        };
    }

    export function resolveBaseVariable(variable: Variable, type: string) {
        let deref = variable.arrayDereferenced;
        if (deref > 0) {
            while (deref-- > 0) {
                type = TypeString.arrayReference(type);
            }
        } else if (deref < 0) {
            while (deref++ < 0) {
                type = TypeString.arrayDereference(type);
            }
        }
        return Variable.create(variable.name, type);
    }
}

class ForeachValueTransform implements NodeTransform {

    phraseType = PhraseType.ForeachValue;
    variables: Variable[];

    constructor() {
        this.variables = [];
    }

    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.SimpleVariable) {
            let ref = (<SimpleVariableTransform>transform).reference;
            this.variables = [{ name: ref.name, arrayDereferenced: 0, type: ref.type }];
        } else if (transform.phraseType === PhraseType.ListIntrinsic) {
            this.variables = (<ListIntrinsicTransform>transform).variables;
        }
    }

}

class ForeachCollectionTransform implements TypeNodeTransform {

    phraseType = PhraseType.ForeachCollection;
    type = '';

    push(transform: NodeTransform) {
        this.type = (<TypeNodeTransform>transform).type || '';
    }
}

class SimpleAssignmentExpressionTransform implements TypeNodeTransform {

    _variables: Variable[];
    type = '';
    private _pushCount = 0;

    constructor(public phraseType: PhraseType, private varTypeOverrides: Tag[]) {
        this._variables = [];
    }

    push(transform: NodeTransform) {
        ++this._pushCount;

        //ws and = should be excluded
        if (this._pushCount === 1) {
            this._lhs(transform);
        } else if (this._pushCount === 2) {
            this.type = (<TypeNodeTransform>transform).type || '';
        }

    }

    private _typeOverride(name: string, tags: Tag[]) {
        if (!tags) {
            return undefined;
        }
        let t: Tag;
        for (let n = 0; n < tags.length; ++n) {
            t = tags[n];
            if (name === t.name) {
                return t.typeString;
            }
        }
        return undefined;
    }

    private _lhs(lhs: NodeTransform) {
        switch (lhs.phraseType) {
            case PhraseType.SimpleVariable:
                {
                    let ref = (<SimpleVariableTransform>lhs).reference;
                    if (ref) {
                        this._variables.push(Variable.create(ref.name, ref.type));
                    }
                    break;
                }
            case PhraseType.SubscriptExpression:
                {
                    let variable = (<SubscriptExpressionTransform>lhs).variable;
                    if (variable) {
                        this._variables.push(variable);
                    }
                    break;
                }
            case PhraseType.ListIntrinsic:
                this._variables = (<ListIntrinsicTransform>lhs).variables;
                break;
            default:
                break;
        }
    }

    get variables() {
        let type = this.type;
        let tags = this.varTypeOverrides;
        let typeOverrideFn = this._typeOverride;
        let fn = (x: Variable) => {
            return Variable.resolveBaseVariable(x, typeOverrideFn(x.name, tags) || type);
        };
        return this._variables.map(fn);
    }

}

class ListIntrinsicTransform implements NodeTransform {

    phraseType = PhraseType.ListIntrinsic;
    variables: Variable[];

    constructor() {
        this.variables = [];
    }

    push(transform: NodeTransform) {

        if (transform.phraseType !== PhraseType.ArrayInitialiserList) {
            return;
        }

        this.variables = (<ArrayInititialiserListTransform>transform).variables;
        for (let n = 0; n < this.variables.length; ++n) {
            this.variables[n].arrayDereferenced--;
        }
    }

}

class ArrayInititialiserListTransform implements TypeNodeTransform {

    phraseType = PhraseType.ArrayInitialiserList;
    variables: Variable[];
    private _types: string[];

    constructor() {
        this.variables = [];
        this._types = [];
    }

    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.ArrayElement) {
            Array.prototype.push.apply(this.variables, (<ArrayElementTransform>transform).variables);
            this._types.push((<ArrayElementTransform>transform).type);
        }
    }

    get type() {
        let merged: string;
        let types: string[];
        if (this._types.length < 4) {
            types = this._types;
        } else {
            types = [this._types[0], this._types[Math.floor(this._types.length / 2)], this._types[this._types.length - 1]];
        }
        merged = TypeString.mergeMany(types);
        return TypeString.count(merged) < 3 && merged.indexOf('mixed') < 0 ? merged : 'mixed';
    }

}

class ArrayElementTransform implements TypeNodeTransform {

    phraseType = PhraseType.ArrayElement;
    variables: Variable[];
    type = '';

    constructor() {
        this.variables = [];
    }

    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.ArrayValue) {
            this.variables = (<ArrayValueTransform>transform).variables;
            this.type = (<ArrayValueTransform>transform).type;
        }
    }

}

class ArrayValueTransform implements TypeNodeTransform {

    phraseType = PhraseType.ArrayValue;
    variables: Variable[];
    type = '';

    constructor() {
        this.variables = [];
    }

    push(transform: NodeTransform) {
        switch (transform.phraseType) {
            case PhraseType.SimpleVariable:
                {
                    let ref = (<SimpleVariableTransform>transform).reference;
                    this.variables = [{ name: ref.name, arrayDereferenced: 0, type: ref.type || '' }];
                    this.type = ref.type;
                }
                break;

            case PhraseType.SubscriptExpression:
                {
                    let v = (<SubscriptExpressionTransform>transform).variable
                    if (v) {
                        this.variables = [v];
                    }
                    this.type = (<SubscriptExpressionTransform>transform).type;
                }
                break;

            case PhraseType.ListIntrinsic:
                this.variables = (<ListIntrinsicTransform>transform).variables;
                break;

            default:
                if (transform.tokenType !== TokenType.Ampersand) {
                    this.type = (<TypeNodeTransform>transform).type;
                }
                break;
        }
    }

}

class CoalesceExpressionTransform implements TypeNodeTransform {

    phraseType = PhraseType.CoalesceExpression;
    type = '';

    push(transform: NodeTransform) {
        this.type = TypeString.merge(this.type, (<TypeNodeTransform>transform).type);
    }

}

class TernaryExpressionTransform implements TypeNodeTransform {

    phraseType = PhraseType.TernaryExpression;
    private _transforms: NodeTransform[];

    constructor() {
        this._transforms = [];
    }

    push(transform: NodeTransform) {
        this._transforms.push(transform);
    }

    get type() {
        return this._transforms.slice(-2).reduce<string>((prev, current) => {
            return TypeString.merge(prev, (<TypeNodeTransform>current).type);
        }, '');
    }

}

class SubscriptExpressionTransform implements TypeNodeTransform, VariableNodeTransform {

    phraseType = PhraseType.SubscriptExpression;
    variable: Variable;
    type = '';
    private _pushCount = 0;

    push(transform: NodeTransform) {

        if (this._pushCount > 0) {
            return;
        }

        ++this._pushCount;

        switch (transform.phraseType) {
            case PhraseType.SimpleVariable:
                {
                    let ref = (<SimpleVariableTransform>transform).reference;
                    if (ref) {
                        this.type = TypeString.arrayDereference(ref.type);
                        this.variable = { name: ref.name, arrayDereferenced: 1, type: this.type };
                    }
                }
                break;

            case PhraseType.SubscriptExpression:
                {
                    let v = (<SubscriptExpressionTransform>transform).variable;
                    this.type = TypeString.arrayDereference((<SubscriptExpressionTransform>transform).type);
                    if (v) {
                        v.arrayDereferenced++;
                        this.variable = v;
                        this.variable.type = this.type;
                    }
                }
                break;

            case PhraseType.FunctionCallExpression:
            case PhraseType.MethodCallExpression:
            case PhraseType.PropertyAccessExpression:
            case PhraseType.ScopedCallExpression:
            case PhraseType.ScopedPropertyAccessExpression:
            case PhraseType.ArrayCreationExpression:
                this.type = TypeString.arrayDereference((<TypeNodeTransform>transform).type);
                break;

            default:
                break;
        }
    }

}

class InstanceOfExpressionTransform implements TypeNodeTransform, VariableNodeTransform {

    phraseType = PhraseType.InstanceOfExpression;
    type = 'bool';
    private _pushCount = 0;
    private _varName = '';
    private _varType = '';

    push(transform: NodeTransform) {

        ++this._pushCount;
        if (this._pushCount === 1) {
            if (transform.phraseType === PhraseType.SimpleVariable) {
                let ref = (<SimpleVariableTransform>transform).reference;
                if (ref) {
                    this._varName = ref.name;
                }
            }
        } else if (transform.phraseType === PhraseType.InstanceofTypeDesignator) {
            this._varType = (<TypeDesignatorTransform>transform).type;
        }

    }

    get variable() {
        return this._varName && this._varType ? { name: this._varName, arrayDereferenced: 0, type: this._varType } : null;
    }

}

class FunctionCallExpressionTransform implements TypeNodeTransform {

    phraseType = PhraseType.FunctionCallExpression;
    type = '';

    constructor(public referenceSymbolDelegate: ReferenceSymbolDelegate) { }

    push(transform: NodeTransform) {
        switch (transform.phraseType) {
            case PhraseType.FullyQualifiedName:
            case PhraseType.RelativeQualifiedName:
            case PhraseType.QualifiedName:
                {
                    let ref = (<ReferenceNodeTransform>transform).reference;
                    this.type = this.referenceSymbolDelegate(ref).reduce(symbolsToTypeReduceFn, '');
                    break;
                }

            default:
                break;
        }
    }

}

class RelativeScopeTransform implements TypeNodeTransform, ReferenceNodeTransform {

    phraseType = PhraseType.RelativeScope;
    reference:Reference;
    constructor(public type: string, loc:lsp.Location) {
        this.reference = Reference.create(SymbolKind.Class, type, loc);
        this.reference.altName = 'static';
     }
    push(transform: NodeTransform) { }
}

class TypeDesignatorTransform implements TypeNodeTransform {

    type = '';

    constructor(public phraseType: PhraseType) { }

    push(transform: NodeTransform) {
        switch (transform.phraseType) {
            case PhraseType.RelativeScope:
            case PhraseType.FullyQualifiedName:
            case PhraseType.RelativeQualifiedName:
            case PhraseType.QualifiedName:
                this.type = (<TypeNodeTransform>transform).type;
                break;

            default:
                break;
        }
    }

}

class AnonymousClassDeclarationTransform implements TypeNodeTransform {
    phraseType = PhraseType.AnonymousClassDeclaration;
    constructor(public type: string) { }
    push(transform: NodeTransform) { }

}

class ObjectCreationExpressionTransform implements TypeNodeTransform {

    phraseType = PhraseType.ObjectCreationExpression;
    type = '';

    push(transform: NodeTransform) {
        if (
            transform.phraseType === PhraseType.ClassTypeDesignator ||
            transform.phraseType === PhraseType.AnonymousClassDeclaration
        ) {
            this.type = (<TypeNodeTransform>transform).type;
        }
    }

}

class SimpleVariableTransform implements TypeNodeTransform, ReferenceNodeTransform {

    phraseType = PhraseType.SimpleVariable;
    reference: Reference;
    private _varTable: VariableTable;

    constructor(loc: lsp.Location, varTable: VariableTable) {
        this._varTable = varTable;
        this.reference = Reference.create(SymbolKind.Variable, '', loc);
    }

    push(transform: NodeTransform) {
        if (transform.tokenType === TokenType.VariableName) {
            this.reference.name = (<TokenTransform>transform).text;
            this.reference.type = this._varTable.getType(this.reference.name);
        }
    }

    get type() {
        return this.reference.type;
    }

}

class FullyQualifiedNameTransform implements TypeNodeTransform, ReferenceNodeTransform {

    phraseType = PhraseType.FullyQualifiedName;
    reference: Reference;

    constructor(symbolKind: SymbolKind, loc: lsp.Location) {
        this.reference = Reference.create(symbolKind, '', loc);
    }

    push(transform: NodeTransform) {

        if (transform.phraseType === PhraseType.NamespaceName) {
            this.reference.name = (<NamespaceNameTransform>transform).text;
        }

    }

    get type() {
        return this.reference.name;
    }

}

class QualifiedNameTransform implements TypeNodeTransform, ReferenceNodeTransform {

    phraseType = PhraseType.QualifiedName;
    reference: Reference;
    private _nameResolver: NameResolver;

    constructor(symbolKind: SymbolKind, loc: lsp.Location, nameResolver: NameResolver) {
        this.reference = Reference.create(symbolKind, '', loc);
        this._nameResolver = nameResolver;
    }

    push(transform: NodeTransform) {

        if (transform.phraseType === PhraseType.NamespaceName) {
            let name = (<NamespaceNameTransform>transform).text;
            let lcName = name.toLowerCase();
            this.reference.name = this._nameResolver.resolveNotFullyQualified(name, this.reference.kind);
            if (
                ((this.reference.kind === SymbolKind.Function || this.reference.kind === SymbolKind.Constant) &&
                name !== this.reference.name && name.indexOf('\\') < 0) || (lcName === 'parent' || lcName === 'self')
            ) {
                this.reference.altName = name;
            }
        }

    }

    get type() {
        return this.reference.name;
    }

}

class RelativeQualifiedNameTransform implements TypeNodeTransform, ReferenceNodeTransform {

    phraseType = PhraseType.RelativeQualifiedName;
    reference: Reference;
    private _nameResolver: NameResolver;

    constructor(symbolKind: SymbolKind, loc: lsp.Location, nameResolver: NameResolver) {
        this.reference = Reference.create(symbolKind, '', loc);
        this._nameResolver = nameResolver;
    }

    push(transform: NodeTransform) {

        if (transform.phraseType === PhraseType.NamespaceName) {
            this.reference.name = this._nameResolver.resolveRelative((<NamespaceNameTransform>transform).text);
        }

    }

    get type() {
        return this.reference.name;
    }

}

class MemberNameTransform implements ReferenceNodeTransform {

    phraseType = PhraseType.MemberName;
    reference: Reference;

    constructor(loc: lsp.Location) {
        this.reference = Reference.create(SymbolKind.None, '', loc);
    }

    push(transform: NodeTransform) {
        if (transform.tokenType === TokenType.Name) {
            this.reference.name = (<TokenTransform>transform).text;
        }
    }

}

class ScopedMemberNameTransform implements ReferenceNodeTransform {

    phraseType = PhraseType.ScopedMemberName;
    reference: Reference;

    constructor(loc: lsp.Location) {
        this.reference = Reference.create(SymbolKind.None, '', loc);
    }

    push(transform: NodeTransform) {
        if (
            transform.tokenType === TokenType.VariableName ||
            transform.phraseType === PhraseType.Identifier
        ) {
            this.reference.name = (<TextNodeTransform>transform).text;
        }
    }

}

class IdentifierTransform implements TextNodeTransform {
    phraseType = PhraseType.Identifier;
    text = '';
    location: lsp.Location;

    push(transform: NodeTransform) {
        this.text = (<TokenTransform>transform).text;
        this.location = (<TokenTransform>transform).location;
    }
}

class MemberAccessExpressionTransform implements TypeNodeTransform, ReferenceNodeTransform {

    reference: Reference;
    private _scope = '';

    constructor(
        public phraseType: PhraseType,
        public symbolKind: SymbolKind,
        public referenceSymbolDelegate: ReferenceSymbolDelegate
    ) { }

    push(transform: NodeTransform) {

        switch (transform.phraseType) {
            case PhraseType.ScopedMemberName:
            case PhraseType.MemberName:
                this.reference = (<ReferenceNodeTransform>transform).reference;
                this.reference.kind = this.symbolKind;
                this.reference.scope = this._scope;
                if (this.symbolKind === SymbolKind.Property && this.reference.name && this.reference.name[0] !== '$') {
                    this.reference.name = '$' + this.reference.name;
                }
                break;

            case PhraseType.ScopedCallExpression:
            case PhraseType.MethodCallExpression:
            case PhraseType.PropertyAccessExpression:
            case PhraseType.ScopedPropertyAccessExpression:
            case PhraseType.FunctionCallExpression:
            case PhraseType.SubscriptExpression:
            case PhraseType.SimpleVariable:
            case PhraseType.FullyQualifiedName:
            case PhraseType.QualifiedName:
            case PhraseType.RelativeQualifiedName:
            case PhraseType.EncapsulatedExpression:
            case PhraseType.RelativeScope:
                this._scope = (<TypeNodeTransform>transform).type;
                break;

            default:
                break;
        }

    }

    get type() {
        return this.referenceSymbolDelegate(this.reference).reduce(symbolsToTypeReduceFn, '');
    }

}

class HeaderTransform implements ReferenceNodeTransform {

    reference: Reference;
    private _kind: SymbolKind;

    constructor(public nameResolver: NameResolver, kind: SymbolKind) {
        this._kind = kind;
    }

    push(transform: NodeTransform) {
        if (transform.tokenType === TokenType.Name) {
            let name = (<TokenTransform>transform).text;
            let loc = (<TokenTransform>transform).location;
            this.reference = Reference.create(this._kind, this.nameResolver.resolveRelative(name), loc);
        }
    }

}

class MemberDeclarationTransform implements ReferenceNodeTransform {

    reference: Reference;
    private _kind: SymbolKind;
    private _scope = '';

    constructor(kind: SymbolKind, scope: string) {
        this._kind = kind;
        this._scope = scope;
    }

    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.Identifier) {
            let name = (<IdentifierTransform>transform).text;
            let loc = (<IdentifierTransform>transform).location;
            this.reference = Reference.create(this._kind, name, loc);
            this.reference.scope = this._scope;
        }
    }

}

class PropertyElementTransform implements ReferenceNodeTransform {

    reference: Reference;
    private _scope = '';

    constructor(scope: string) {
        this._scope = scope;
    }

    push(transform: NodeTransform) {
        if (transform.tokenType === TokenType.VariableName) {
            let name = (<IdentifierTransform>transform).text;
            let loc = (<IdentifierTransform>transform).location;
            this.reference = Reference.create(SymbolKind.Property, name, loc);
            this.reference.scope = this._scope;
        }
    }

}

class NamespaceDefinitionTransform implements ReferenceNodeTransform {

    reference: Reference;

    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.NamespaceName) {
            this.reference = Reference.create(SymbolKind.Namespace, (<NamespaceNameTransform>transform).text, (<NamespaceNameTransform>transform).location);
        }
    }

}

class ParameterDeclarationTransform implements ReferenceNodeTransform {

    reference: Reference;

    push(transform: NodeTransform) {
        if (transform.tokenType === TokenType.VariableName) {
            this.reference = Reference.create(SymbolKind.Parameter, (<TokenTransform>transform).text, (<TokenTransform>transform).location);
        }
    }

}

class EncapsulatedExpressionTransform implements ReferenceNodeTransform, TypeNodeTransform {

    phraseType = PhraseType.EncapsulatedExpression;
    private _transform: NodeTransform;

    push(transform: NodeTransform) {
        if (transform.phraseType || (transform.tokenType >= TokenType.DirectoryConstant && transform.tokenType <= TokenType.IntegerLiteral)) {
            this._transform = transform;
        }
    }

    get reference() {
        return this._transform ? (<ReferenceNodeTransform>this._transform).reference : undefined;
    }

    get type() {
        return this._transform ? (<TypeNodeTransform>this._transform).type : undefined;
    }

}

class VariableTable {

    private _typeVariableSetStack: VariableSet[];

    constructor() {
        this._typeVariableSetStack = [VariableSet.create(VariableSetKind.Scope)];
    }

    setVariable(v: Variable) {
        if (!v || !v.name || !v.type) {
            return;
        }
        this._typeVariableSetStack[this._typeVariableSetStack.length - 1].variables[v.name] = v;
    }

    setVariables(vars: Variable[]) {
        if (!vars) {
            return;
        }
        for (let n = 0; n < vars.length; ++n) {
            this.setVariable(vars[n]);
        }
    }

    pushScope(carry?: string[]) {

        let scope = VariableSet.create(VariableSetKind.Scope);

        if (carry) {
            let type: string;
            let name: string
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
        let b = VariableSet.create(VariableSetKind.Branch);
        this._typeVariableSetStack[this._typeVariableSetStack.length - 1].branches.push(b);
        this._typeVariableSetStack.push(b);
    }

    popBranch() {
        this._typeVariableSetStack.pop();
    }

    /**
     * consolidates variables. 
     * each variable can be any of types discovered in branches after this.
     */
    pruneBranches() {

        let node = this._typeVariableSetStack[this._typeVariableSetStack.length - 1];
        let branches = node.branches;
        node.branches = [];
        for (let n = 0, l = branches.length; n < l; ++n) {
            this._mergeSets(node, branches[n]);
        }

    }

    getType(varName: string) {

        let typeSet: VariableSet;

        for (let n = this._typeVariableSetStack.length - 1; n >= 0; --n) {
            typeSet = this._typeVariableSetStack[n];
            if (typeSet.variables[varName]) {
                return typeSet.variables[varName].type;
            }

            if (typeSet.kind === VariableSetKind.Scope) {
                break;
            }
        }

        return '';

    }

    private _mergeSets(a: VariableSet, b: VariableSet) {

        let keys = Object.keys(b.variables);
        let v: Variable;
        for (let n = 0, l = keys.length; n < l; ++n) {
            v = b.variables[keys[n]];
            if (a.variables[v.name]) {
                a.variables[v.name].type = TypeString.merge(a.variables[v.name].type, v.type);
            } else {
                a.variables[v.name] = v;
            }
        }

    }

}

const enum VariableSetKind {
    None, Scope, BranchGroup, Branch
}

interface VariableSet {
    kind: VariableSetKind;
    variables: { [index: string]: Variable };
    branches: VariableSet[];
}

namespace VariableSet {
    export function create(kind: VariableSetKind) {
        return <VariableSet>{
            kind: kind,
            variables: {},
            branches: []
        };
    }
}

export namespace ReferenceReader {
    export function discoverReferences(doc: ParsedDocument, symbolStore: SymbolStore) {
        let visitor = new ReferenceReader(doc, new NameResolver(), symbolStore);
        doc.traverse(visitor);
        return visitor.refTable;
    }
}