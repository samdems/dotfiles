/* Copyright (c) Ben Robert Mewburn
 * Licensed under the ISC Licence.
 */

'use strict';

import { TreeVisitor, MultiVisitor, HashedLocation } from './types';
import { ParsedDocument, NodeTransform } from './parsedDocument';
import { Phrase, PhraseType, Token, TokenType } from 'php7parser';
import { PhpDoc, PhpDocParser, Tag, MethodTagParam } from './phpDoc';
import { PhpSymbol, SymbolKind, SymbolModifier, PhpSymbolDoc } from './symbol';
import { NameResolver } from './nameResolver';
import { TypeString } from './typeString';
import * as util from './util';

export class SymbolReader implements TreeVisitor<Phrase | Token> {

    lastPhpDoc: PhpDoc;
    lastPhpDocLocation: HashedLocation;

    private _transformStack: NodeTransform[];
    private _uriHash = 0;

    constructor(
        public document: ParsedDocument,
        public nameResolver: NameResolver
    ) {
        this._transformStack = [new FileTransform(this.document.uri, this.document.nodeHashedLocation(this.document.tree))];
        this._uriHash = Math.abs(util.hash32(document.uri));
    }

    get symbol() {
        return (<FileTransform>this._transformStack[0]).symbol;
    }

    preorder(node: Phrase | Token, spine: (Phrase | Token)[]) {

        let s: PhpSymbol;
        let parentNode = <Phrase>(spine.length ? spine[spine.length - 1] : { phraseType: PhraseType.Unknown, children: [] });
        let parentTransform = this._transformStack[this._transformStack.length - 1];

        switch ((<Phrase>node).phraseType) {

            case PhraseType.Error:
                this._transformStack.push(null);
                return false;

            case PhraseType.NamespaceDefinition:
                {
                    let t = new NamespaceDefinitionTransform(this.document.nodeHashedLocation(node));
                    this._transformStack.push(t);
                    this.nameResolver.namespace = t.symbol;
                }
                break;

            case PhraseType.NamespaceUseDeclaration:
                this._transformStack.push(new NamespaceUseDeclarationTransform());
                break;

            case PhraseType.NamespaceUseClauseList:
            case PhraseType.NamespaceUseGroupClauseList:
                this._transformStack.push(new NamespaceUseClauseListTransform((<Phrase>node).phraseType));
                break;

            case PhraseType.NamespaceUseClause:
            case PhraseType.NamespaceUseGroupClause:
                {
                    let t = new NamespaceUseClauseTransform((<Phrase>node).phraseType, this.document.nodeHashedLocation(node));
                    this._transformStack.push(t);
                    this.nameResolver.rules.push(t.symbol);
                }
                break;

            case PhraseType.NamespaceAliasingClause:
                this._transformStack.push(new NamespaceAliasingClause());
                break;

            case PhraseType.ConstElement:
                this._transformStack.push(
                    new ConstElementTransform(this.nameResolver, this.document.nodeHashedLocation(node), this.lastPhpDoc, this.lastPhpDocLocation
                    ));
                break;

            case PhraseType.FunctionDeclaration:
                this._transformStack.push(new FunctionDeclarationTransform(
                    this.nameResolver, this.document.nodeHashedLocation(node), this.lastPhpDoc, this.lastPhpDocLocation
                ));
                break;

            case PhraseType.FunctionDeclarationHeader:
                this._transformStack.push(new FunctionDeclarationHeaderTransform());
                break;

            case PhraseType.ParameterDeclarationList:
                this._transformStack.push(new DelimiteredListTransform(PhraseType.ParameterDeclarationList));
                break;

            case PhraseType.ParameterDeclaration:
                this._transformStack.push(new ParameterDeclarationTransform(
                    this.document.nodeHashedLocation(node), this.lastPhpDoc, this.lastPhpDocLocation, this.nameResolver
                ));
                break;

            case PhraseType.TypeDeclaration:
                this._transformStack.push(new TypeDeclarationTransform());
                break;

            case PhraseType.ReturnType:
                this._transformStack.push(new ReturnTypeTransform());
                break;

            case PhraseType.FunctionDeclarationBody:
            case PhraseType.MethodDeclarationBody:
                this._transformStack.push(new FunctionDeclarationBodyTransform((<Phrase>node).phraseType));
                break;

            case PhraseType.ClassDeclaration:
                {
                    let t = new ClassDeclarationTransform(
                        this.nameResolver, this.document.nodeHashedLocation(node), this.lastPhpDoc, this.lastPhpDocLocation
                    );
                    this._transformStack.push(t);
                    this.nameResolver.pushClass(t.symbol);
                }
                break;

            case PhraseType.ClassDeclarationHeader:
                this._transformStack.push(new ClassDeclarationHeaderTransform());
                break;

            case PhraseType.ClassBaseClause:
                this._transformStack.push(new ClassBaseClauseTransform());
                break;

            case PhraseType.ClassInterfaceClause:
                this._transformStack.push(new ClassInterfaceClauseTransform());
                break;

            case PhraseType.QualifiedNameList:
                if (parentTransform) {
                    this._transformStack.push(new DelimiteredListTransform(PhraseType.QualifiedNameList));
                } else {
                    this._transformStack.push(null);
                }
                break;

            case PhraseType.ClassDeclarationBody:
                this._transformStack.push(new TypeDeclarationBodyTransform(PhraseType.ClassDeclarationBody));
                break;

            case PhraseType.InterfaceDeclaration:
                {
                    let t = new InterfaceDeclarationTransform(
                        this.nameResolver, this.document.nodeHashedLocation(node), this.lastPhpDoc, this.lastPhpDocLocation
                    );
                    this._transformStack.push(t);
                    this.nameResolver.pushClass(t.symbol);
                }
                break;

            case PhraseType.InterfaceDeclarationHeader:
                this._transformStack.push(new InterfaceDeclarationHeaderTransform());
                break;

            case PhraseType.InterfaceBaseClause:
                this._transformStack.push(new InterfaceBaseClauseTransform());
                break;

            case PhraseType.InterfaceDeclarationBody:
                this._transformStack.push(new TypeDeclarationBodyTransform(PhraseType.InterfaceDeclarationBody));
                break;

            case PhraseType.TraitDeclaration:
                this._transformStack.push(new TraitDeclarationTransform(
                    this.nameResolver, this.document.nodeHashedLocation(node), this.lastPhpDoc, this.lastPhpDocLocation
                ));
                break;

            case PhraseType.TraitDeclarationHeader:
                this._transformStack.push(new TraitDeclarationHeaderTransform());
                break;

            case PhraseType.TraitDeclarationBody:
                this._transformStack.push(new TypeDeclarationBodyTransform(PhraseType.TraitDeclarationBody));
                break;

            case PhraseType.ClassConstDeclaration:
                this._transformStack.push(new FieldDeclarationTransform(PhraseType.ClassConstDeclaration));
                break;

            case PhraseType.ClassConstElementList:
                this._transformStack.push(new DelimiteredListTransform(PhraseType.ClassConstElementList));
                break;

            case PhraseType.ClassConstElement:
                this._transformStack.push(new ClassConstantElementTransform(
                    this.nameResolver, this.document.nodeHashedLocation(node), this.lastPhpDoc, this.lastPhpDocLocation
                ));
                break;

            case PhraseType.PropertyDeclaration:
                this._transformStack.push(new FieldDeclarationTransform(PhraseType.PropertyDeclaration));
                break;

            case PhraseType.PropertyElementList:
                this._transformStack.push(new DelimiteredListTransform(PhraseType.PropertyElementList));
                break;

            case PhraseType.PropertyElement:
                this._transformStack.push(new PropertyElementTransform(
                    this.nameResolver, this.document.nodeHashedLocation(node), this.lastPhpDoc, this.lastPhpDocLocation
                ));
                break;

            case PhraseType.PropertyInitialiser:
                this._transformStack.push(new PropertyInitialiserTransform());
                break;

            case PhraseType.TraitUseClause:
                this._transformStack.push(new TraitUseClauseTransform());
                break;

            case PhraseType.MethodDeclaration:
                this._transformStack.push(new MethodDeclarationTransform(
                    this.nameResolver, this.document.nodeHashedLocation(node), this.lastPhpDoc, this.lastPhpDocLocation
                ));
                break;

            case PhraseType.MethodDeclarationHeader:
                this._transformStack.push(new MethodDeclarationHeaderTransform());
                break;

            case PhraseType.Identifier:
                if (parentNode.phraseType === PhraseType.MethodDeclarationHeader || parentNode.phraseType === PhraseType.ClassConstElement) {
                    this._transformStack.push(new IdentifierTransform());
                } else {
                    this._transformStack.push(null);
                }
                break;

            case PhraseType.MemberModifierList:
                this._transformStack.push(new MemberModifierListTransform());
                break;

            case PhraseType.AnonymousClassDeclaration:
                {
                    let t = new AnonymousClassDeclarationTransform(
                        this.document.nodeHashedLocation(node), this.document.createAnonymousName(<Phrase>node)
                    );
                    this._transformStack.push(t);
                    this.nameResolver.pushClass(t.symbol);
                }
                break;

            case PhraseType.AnonymousClassDeclarationHeader:
                this._transformStack.push(new AnonymousClassDeclarationHeaderTransform());
                break;

            case PhraseType.AnonymousFunctionCreationExpression:
                this._transformStack.push(new AnonymousFunctionCreationExpressionTransform(
                    this.document.nodeHashedLocation(node), this.document.createAnonymousName(<Phrase>node)
                ));
                break;

            case PhraseType.AnonymousFunctionHeader:
                this._transformStack.push(new AnonymousFunctionHeaderTransform());
                break;

            case PhraseType.AnonymousFunctionUseClause:
                this._transformStack.push(new AnonymousFunctionUseClauseTransform());
                break;

            case PhraseType.ClosureUseList:
                this._transformStack.push(new DelimiteredListTransform(PhraseType.ClosureUseList));
                break;

            case PhraseType.AnonymousFunctionUseVariable:
                this._transformStack.push(new AnonymousFunctionUseVariableTransform(this.document.nodeHashedLocation(node)));
                break;

            case PhraseType.SimpleVariable:
                this._transformStack.push(new SimpleVariableTransform(this.document.nodeHashedLocation(node)));
                break;

            case PhraseType.FunctionCallExpression:
                //define
                if ((<Phrase>node).children.length) {
                    let name = this.document.nodeText((<Phrase>node).children[0]).toLowerCase();
                    if (name === 'define' || name === '\\define') {
                        this._transformStack.push(new DefineFunctionCallExpressionTransform(this.document.nodeHashedLocation(node)));
                        break;
                    }
                }
                this._transformStack.push(null);
                break;

            case PhraseType.ArgumentExpressionList:
                if (parentNode.phraseType === PhraseType.FunctionCallExpression && parentTransform) {
                    this._transformStack.push(new DelimiteredListTransform(PhraseType.ArgumentExpressionList));
                } else {
                    this._transformStack.push(null);
                }
                break;

            case PhraseType.FullyQualifiedName:
                if (parentTransform) {
                    this._transformStack.push(new FullyQualifiedNameTransform());
                } else {
                    this._transformStack.push(null);
                }
                break;

            case PhraseType.RelativeQualifiedName:
                if (parentTransform) {
                    this._transformStack.push(new RelativeQualifiedNameTransform(this.nameResolver));
                } else {
                    this._transformStack.push(null);
                }
                break;

            case PhraseType.QualifiedName:
                if (parentTransform) {
                    this._transformStack.push(new QualifiedNameTransform(this.nameResolver));
                } else {
                    this._transformStack.push(null);
                }
                break;

            case PhraseType.NamespaceName:
                if (parentTransform) {
                    this._transformStack.push(new NamespaceNameTransform());
                } else {
                    this._transformStack.push(null);
                }
                break;

            case undefined:
                //tokens
                if ((<Token>node).tokenType === TokenType.DocumentComment) {

                    this.lastPhpDoc = PhpDocParser.parse(this.document.nodeText(node));
                    this.lastPhpDocLocation = this.document.nodeHashedLocation(node);

                } else if ((<Token>node).tokenType === TokenType.CloseBrace) {

                    this.lastPhpDoc = null;
                    this.lastPhpDocLocation = null;

                } else if ((<Token>node).tokenType === TokenType.VariableName && parentNode.phraseType === PhraseType.CatchClause) {
                    //catch clause vars
                    for (let n = this._transformStack.length - 1; n > -1; --n) {
                        if (this._transformStack[n]) {
                            this._transformStack[n].push(new CatchClauseVariableNameTransform(this.document.tokenText(<Token>node), this.document.nodeHashedLocation(node)));
                            break;
                        }
                    }

                } else if (parentTransform && (<Token>node).tokenType > TokenType.EndOfFile && (<Token>node).tokenType < TokenType.Equals) {

                    parentTransform.push(new TokenTransform(<Token>node, this.document));

                }
                break;

            default:

                if (
                    parentNode.phraseType === PhraseType.ConstElement ||
                    parentNode.phraseType === PhraseType.ClassConstElement ||
                    parentNode.phraseType === PhraseType.ParameterDeclaration ||
                    (parentNode.phraseType === PhraseType.ArgumentExpressionList && parentTransform)
                ) {
                    this._transformStack.push(new DefaultNodeTransform((<Phrase>node).phraseType, this.document.nodeText(node)));
                } else {
                    this._transformStack.push(null);
                }
                break;
        }

        return true;

    }

    postorder(node: Phrase | Token, spine: (Phrase | Token)[]) {

        if (!(<Phrase>node).phraseType) {
            return;
        }

        let transform = this._transformStack.pop();
        if (!transform) {
            return;
        }

        for (let n = this._transformStack.length - 1; n > -1; --n) {
            if (this._transformStack[n]) {
                this._transformStack[n].push(transform);
                break;
            }
        }

        switch ((<Phrase>node).phraseType) {
            case PhraseType.ClassDeclarationHeader:
            case PhraseType.InterfaceDeclarationHeader:
            case PhraseType.AnonymousClassDeclarationHeader:
            case PhraseType.FunctionDeclarationHeader:
            case PhraseType.MethodDeclarationHeader:
            case PhraseType.TraitDeclarationHeader:
            case PhraseType.AnonymousFunctionHeader:
                this.lastPhpDoc = null;
                this.lastPhpDocLocation = null;
                break;

            default:
                break;
        }

    }

}

/**
 * Ensures that there are no variable and parameter symbols with same name
 * and excludes inbuilt vars
 */
class UniqueSymbolCollection {

    private _symbols: PhpSymbol[];
    private _varMap: { [index: string]: boolean };
    private static _inbuilt = {
        '$GLOBALS': true,
        '$_SERVER': true,
        '$_GET': true,
        '$_POST': true,
        '$_FILES': true,
        '$_REQUEST': true,
        '$_SESSION': true,
        '$_ENV': true,
        '$_COOKIE': true,
        '$php_errormsg': true,
        '$HTTP_RAW_POST_DATA': true,
        '$http_response_header': true,
        '$argc': true,
        '$argv': true,
        '$this': true
    };

    constructor() {
        this._symbols = [];
        this._varMap = Object.assign({}, UniqueSymbolCollection._inbuilt);
    }

    get length() {
        return this._symbols.length;
    }

    push(s: PhpSymbol) {
        if (s.kind & (SymbolKind.Parameter | SymbolKind.Variable)) {
            if (this._varMap[s.name] === undefined) {
                this._varMap[s.name] = true;
                this._symbols.push(s);
            }
        } else {
            this._symbols.push(s);
        }
    }

    pushMany(symbols: PhpSymbol[]) {
        for (let n = 0, l = symbols.length; n < l; ++n) {
            this.push(symbols[n]);
        }
    }

    toArray() {
        return this._symbols;
    }
}

interface SymbolNodeTransform extends NodeTransform {
    symbol: PhpSymbol;
}

interface NameNodeTransform extends NodeTransform {
    name: string;
    unresolved: string;
}

interface TextNodeTransform extends NodeTransform {
    text: string;
}

interface SymbolsNodeTransform extends NodeTransform {
    symbols: PhpSymbol[];
}

class FileTransform implements SymbolNodeTransform {

    private _children: UniqueSymbolCollection;
    private _symbol: PhpSymbol;

    constructor(uri: string, location: HashedLocation) {
        this._symbol = PhpSymbol.create(SymbolKind.File, uri, location);
        this._children = new UniqueSymbolCollection();
    }

    push(transform: NodeTransform) {

        let s = (<SymbolNodeTransform>transform).symbol;
        if (s) {
            this._children.push(s);
            return;
        }

        let symbols = (<SymbolsNodeTransform>transform).symbols;
        if (symbols) {
            this._children.pushMany(symbols);
        }

    }

    get symbol() {
        this._symbol.children = this._children.toArray();
        return this._symbol;
    }

}

class DelimiteredListTransform implements NodeTransform {

    transforms: NodeTransform[];

    constructor(public phraseType: PhraseType) {
        this.transforms = [];
    }

    push(transform: NodeTransform) {
        this.transforms.push(transform);
    }

}

class TokenTransform implements TextNodeTransform {

    constructor(public token: Token, public doc: ParsedDocument) { }

    push(transform: NodeTransform) { }

    get text() {
        return this.doc.tokenText(this.token);
    }

    get tokenType() {
        return this.token.tokenType;
    }

    get location() {
        return this.doc.nodeHashedLocation(this.token);
    }

}

class NamespaceNameTransform implements TextNodeTransform {

    phraseType = PhraseType.NamespaceName;
    private _parts: string[];

    constructor() {
        this._parts = [];
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

class QualifiedNameTransform implements NameNodeTransform {

    phraseType = PhraseType.QualifiedName;
    name = '';
    unresolved = '';
    constructor(public nameResolver: NameResolver) { }
    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.NamespaceName) {
            this.unresolved = (<NamespaceNameTransform>transform).text;
            this.name = this.nameResolver.resolveNotFullyQualified(this.unresolved);
        }
    }

}

class RelativeQualifiedNameTransform implements NameNodeTransform {

    phraseType = PhraseType.RelativeQualifiedName;
    name = '';
    unresolved = '';
    constructor(public nameResolver: NameResolver) { }

    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.NamespaceName) {
            this.unresolved = (<NamespaceNameTransform>transform).text;
            this.name = this.nameResolver.resolveRelative(this.unresolved);
        }
    }

}

class FullyQualifiedNameTransform implements NameNodeTransform {

    phraseType = PhraseType.FullyQualifiedName;
    name = '';
    unresolved = '';
    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.NamespaceName) {
            this.name = this.unresolved = (<NamespaceNameTransform>transform).text;
        }
    }

}

class CatchClauseVariableNameTransform implements SymbolNodeTransform {
    tokenType = TokenType.VariableName;
    symbol: PhpSymbol;
    constructor(name: string, location: HashedLocation) {
        this.symbol = PhpSymbol.create(SymbolKind.Variable, name, location);
    }
    push(transform: NodeTransform) { }
}

class ParameterDeclarationTransform implements SymbolNodeTransform {

    phraseType = PhraseType.ParameterDeclaration;
    symbol: PhpSymbol;
    private _doc: PhpDoc;
    private _nameResolver: NameResolver;
    private _docLocation: HashedLocation;

    constructor(location: HashedLocation, doc: PhpDoc, docLocation: HashedLocation, nameResolver: NameResolver) {
        this.symbol = PhpSymbol.create(SymbolKind.Parameter, '', location);
        this._doc = doc;
        this._docLocation = docLocation;
        this._nameResolver = nameResolver;
    }

    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.TypeDeclaration) {
            this.symbol.type = (<TypeDeclarationTransform>transform).type;
        } else if (transform.tokenType === TokenType.Ampersand) {
            this.symbol.modifiers |= SymbolModifier.Reference;
        } else if (transform.tokenType === TokenType.Ellipsis) {
            this.symbol.modifiers |= SymbolModifier.Variadic;
        } else if (transform.tokenType === TokenType.VariableName) {
            this.symbol.name = (<TokenTransform>transform).text;
            SymbolReader.assignPhpDocInfoToSymbol(this.symbol, this._doc, this._docLocation, this._nameResolver);
        } else {
            this.symbol.value = (<TextNodeTransform>transform).text;
        }
    }

}

class DefineFunctionCallExpressionTransform implements SymbolNodeTransform {

    phraseType = PhraseType.FunctionCallExpression;
    symbol: PhpSymbol;
    constructor(location: HashedLocation) {
        this.symbol = PhpSymbol.create(SymbolKind.Constant, '', location);
    }

    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.ArgumentExpressionList) {

            let arg1: TextNodeTransform, arg2: TextNodeTransform;
            [arg1, arg2] = (<DelimiteredListTransform>transform).transforms as TextNodeTransform[];

            if (arg1 && arg1.tokenType === TokenType.StringLiteral) {
                this.symbol.name = arg1.text.slice(1, -1); //remove quotes
            }

            //todo --this could be an array or constant too
            if (arg2 && (arg2.tokenType === TokenType.FloatingLiteral ||
                arg2.tokenType === TokenType.IntegerLiteral ||
                arg2.tokenType === TokenType.StringLiteral)) {
                this.symbol.value = arg2.text;
            }

            if (this.symbol.name && this.symbol.name[0] === '\\') {
                this.symbol.name = this.symbol.name.slice(1);
            }
        }
    }

}

class SimpleVariableTransform implements SymbolNodeTransform {

    phraseType = PhraseType.SimpleVariable;
    symbol: PhpSymbol;
    constructor(location: HashedLocation) {
        this.symbol = PhpSymbol.create(SymbolKind.Variable, '', location);
    }

    push(transform: NodeTransform) {
        if (transform.tokenType === TokenType.VariableName) {
            this.symbol.name = (<TokenTransform>transform).text;
        }
    }

}

class AnonymousClassDeclarationTransform implements SymbolNodeTransform {

    phraseType = PhraseType.AnonymousClassDeclaration;
    symbol: PhpSymbol;

    constructor(location: HashedLocation, name: string) {
        this.symbol = PhpSymbol.create(SymbolKind.Class, name, location);
        this.symbol.modifiers = SymbolModifier.Anonymous;
        this.symbol.children = [];
        this.symbol.associated = [];
    }

    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.AnonymousClassDeclarationHeader) {
            if ((<AnonymousClassDeclarationHeaderTransform>transform).base) {
                this.symbol.associated.push((<AnonymousClassDeclarationHeaderTransform>transform).base);
            }
            Array.prototype.push.apply(this.symbol.associated, (<AnonymousClassDeclarationHeaderTransform>transform).interfaces);
        } else if (transform.phraseType === PhraseType.ClassDeclarationBody) {
            Array.prototype.push.apply(this.symbol.children, PhpSymbol.setScope((<TypeDeclarationBodyTransform>transform).declarations, this.symbol.name))
            Array.prototype.push.apply(this.symbol.associated, (<TypeDeclarationBodyTransform>transform).useTraits);
        }
    }

}

class TypeDeclarationBodyTransform implements NodeTransform {

    declarations: PhpSymbol[];
    useTraits: PhpSymbol[];

    constructor(public phraseType: PhraseType) {
        this.declarations = [];
        this.useTraits = [];
    }

    push(transform: NodeTransform) {

        switch (transform.phraseType) {
            case PhraseType.ClassConstDeclaration:
            case PhraseType.PropertyDeclaration:
                Array.prototype.push.apply(this.declarations, (<FieldDeclarationTransform>transform).symbols);
                break;

            case PhraseType.MethodDeclaration:
                this.declarations.push((<MethodDeclarationTransform>transform).symbol);
                break;

            case PhraseType.TraitUseClause:
                Array.prototype.push.apply(this.useTraits, (<TraitUseClauseTransform>transform).symbols);
                break;

            default:
                break;

        }
    }

}

class AnonymousClassDeclarationHeaderTransform implements NodeTransform {

    phraseType = PhraseType.AnonymousClassDeclarationHeader;
    base: PhpSymbol;
    interfaces: PhpSymbol[];

    constructor() {
        this.interfaces = [];
    }

    push(transform: NodeTransform) {

        if (transform.phraseType === PhraseType.ClassBaseClause) {
            this.base = (<ClassBaseClauseTransform>transform).symbol;
        } else if (transform.phraseType === PhraseType.ClassInterfaceClause) {
            this.interfaces = (<ClassInterfaceClauseTransform>transform).symbols;
        }

    }

}

class AnonymousFunctionCreationExpressionTransform implements SymbolNodeTransform {

    phraseType = PhraseType.AnonymousFunctionCreationExpression;
    private _symbol: PhpSymbol;
    private _children: UniqueSymbolCollection;

    constructor(location: HashedLocation, name: string) {
        this._symbol = PhpSymbol.create(SymbolKind.Function, name, location);
        this._symbol.modifiers = SymbolModifier.Anonymous;
        this._children = new UniqueSymbolCollection();
    }

    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.AnonymousFunctionHeader) {
            this._symbol.modifiers |= (<AnonymousFunctionHeaderTransform>transform).modifier;
            this._children.pushMany((<AnonymousFunctionHeaderTransform>transform).parameters);
            this._children.pushMany((<AnonymousFunctionHeaderTransform>transform).uses);
            this._symbol.type = (<AnonymousFunctionHeaderTransform>transform).returnType;
        } else if (transform.phraseType === PhraseType.FunctionDeclarationBody) {
            this._children.pushMany((<FunctionDeclarationBodyTransform>transform).symbols);
        }
    }

    get symbol() {
        this._symbol.children = PhpSymbol.setScope(this._children.toArray(), this._symbol.name);
        return this._symbol;
    }

}

class AnonymousFunctionHeaderTransform implements NodeTransform {

    phraseType = PhraseType.AnonymousFunctionHeader;
    modifier = SymbolModifier.None;
    parameters: PhpSymbol[];
    uses: PhpSymbol[];
    returnType = '';

    constructor() {
        this.parameters = [];
        this.uses = [];
    }

    push(transform: NodeTransform) {
        if (transform.tokenType === TokenType.Ampersand) {
            this.modifier |= SymbolModifier.Reference;
        } else if (transform.tokenType === TokenType.Static) {
            this.modifier |= SymbolModifier.Static;
        } else if (transform.phraseType === PhraseType.ParameterDeclarationList) {
            let transforms = (<DelimiteredListTransform>transform).transforms as SymbolNodeTransform[];
            for (let n = 0; n < transforms.length; ++n) {
                this.parameters.push(transforms[n].symbol);
            }
        } else if (transform.phraseType === PhraseType.AnonymousFunctionUseClause) {
            let symbols = (<AnonymousFunctionUseClauseTransform>transform).symbols;
            for (let n = 0; n < symbols.length; ++n) {
                this.uses.push(symbols[n]);
            }
        } else if (transform.phraseType === PhraseType.ReturnType) {
            this.returnType = (<ReturnTypeTransform>transform).type;
        }
    }

}

class FunctionDeclarationBodyTransform implements SymbolsNodeTransform {

    private _value: UniqueSymbolCollection;

    constructor(public phraseType: PhraseType) {
        this._value = new UniqueSymbolCollection();
    }

    push(transform: NodeTransform) {

        switch (transform.phraseType) {
            case PhraseType.SimpleVariable:
            case PhraseType.AnonymousFunctionCreationExpression:
            case PhraseType.AnonymousClassDeclaration:
            case PhraseType.FunctionCallExpression: //define    
                this._value.push((<SymbolNodeTransform>transform).symbol);
                break;

            case undefined:
                //catch clause vars
                if (transform instanceof CatchClauseVariableNameTransform) {
                    this._value.push(transform.symbol);
                }
                break;

            default:
                break;
        }

    }

    get symbols() {
        return this._value.toArray();
    }

}

class AnonymousFunctionUseClauseTransform implements SymbolsNodeTransform {

    phraseType = PhraseType.AnonymousFunctionUseClause;
    symbols: PhpSymbol[];

    constructor() {
        this.symbols = [];
    }

    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.ClosureUseList) {
            let transforms = (<DelimiteredListTransform>transform).transforms as SymbolNodeTransform[];
            for (let n = 0; n < transforms.length; ++n) {
                this.symbols.push(transforms[n].symbol);
            }
        }
    }

}

class AnonymousFunctionUseVariableTransform implements SymbolNodeTransform {

    phraseType = PhraseType.AnonymousFunctionUseVariable;
    symbol: PhpSymbol;

    constructor(location: HashedLocation) {
        this.symbol = PhpSymbol.create(SymbolKind.Variable, '', location);
        this.symbol.modifiers = SymbolModifier.Use;
    }

    push(transform: NodeTransform) {
        if (transform.tokenType === TokenType.VariableName) {
            this.symbol.name = (<TokenTransform>transform).text;
        } else if (transform.tokenType === TokenType.Ampersand) {
            this.symbol.modifiers |= SymbolModifier.Reference;
        }
    }

}

class InterfaceDeclarationTransform implements SymbolNodeTransform {

    phraseType = PhraseType.InterfaceDeclaration;
    symbol: PhpSymbol;

    constructor(public nameResolver: NameResolver, location: HashedLocation, doc: PhpDoc, docLocation: HashedLocation) {
        this.symbol = PhpSymbol.create(SymbolKind.Interface, '', location);
        SymbolReader.assignPhpDocInfoToSymbol(this.symbol, doc, docLocation, nameResolver);
        this.symbol.children = [];
        this.symbol.associated = [];
    }

    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.InterfaceDeclarationHeader) {
            this.symbol.name = this.nameResolver.resolveRelative((<InterfaceDeclarationHeaderTransform>transform).name);
            this.symbol.associated = (<InterfaceDeclarationHeaderTransform>transform).extends;
        } else if (transform.phraseType === PhraseType.InterfaceDeclarationBody) {
            Array.prototype.push.apply(this.symbol.children, PhpSymbol.setScope((<TypeDeclarationBodyTransform>transform).declarations, this.symbol.name));
        }
    }

}

class ConstElementTransform implements SymbolNodeTransform {

    phraseType = PhraseType.ConstElement;
    symbol: PhpSymbol;
    private _doc: PhpDoc;
    private _docLocation: HashedLocation;

    constructor(public nameResolver: NameResolver, location: HashedLocation, doc: PhpDoc, docLocation: HashedLocation) {
        this.symbol = PhpSymbol.create(SymbolKind.Constant, '', location);
        this.symbol.scope = this.nameResolver.namespaceName;
        this._doc = doc;
        this._docLocation = docLocation;
    }

    push(transform: NodeTransform) {

        if (transform.tokenType === TokenType.Name) {
            this.symbol.name = this.nameResolver.resolveRelative((<TokenTransform>transform).text);
            SymbolReader.assignPhpDocInfoToSymbol(this.symbol, this._doc, this._docLocation, this.nameResolver);
        } else {
            //expression
            this.symbol.value = (<TextNodeTransform>transform).text;
        }

    }

}

class TraitDeclarationTransform implements SymbolNodeTransform {

    phraseType = PhraseType.TraitDeclaration;
    symbol: PhpSymbol;

    constructor(public nameResolver: NameResolver, location: HashedLocation, doc: PhpDoc, docLocation: HashedLocation) {
        this.symbol = PhpSymbol.create(SymbolKind.Trait, '', location);
        SymbolReader.assignPhpDocInfoToSymbol(this.symbol, doc, docLocation, nameResolver);
        this.symbol.children = [];
        this.symbol.associated = [];
    }

    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.TraitDeclarationHeader) {
            this.symbol.name = this.nameResolver.resolveRelative((<TraitDeclarationHeaderTransform>transform).name);
        } else if (transform.phraseType === PhraseType.TraitDeclarationBody) {
            Array.prototype.push.apply(this.symbol.children, PhpSymbol.setScope((<TypeDeclarationBodyTransform>transform).declarations, this.symbol.name));
            Array.prototype.push.apply(this.symbol.associated, (<TypeDeclarationBodyTransform>transform).useTraits);
        }
    }

}

class TraitDeclarationHeaderTransform implements NodeTransform {
    phraseType = PhraseType.TraitDeclarationHeader;
    name = '';

    push(transform: NodeTransform) {
        if (transform.tokenType === TokenType.Name) {
            this.name = (<TokenTransform>transform).text;
        }
    }

}

class InterfaceBaseClauseTransform implements SymbolsNodeTransform {
    phraseType = PhraseType.InterfaceBaseClause;
    symbols: PhpSymbol[];

    constructor() {
        this.symbols = [];
    }

    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.QualifiedNameList) {
            let transforms = (<DelimiteredListTransform>transform).transforms as NameNodeTransform[];
            for (let n = 0; n < transforms.length; ++n) {
                this.symbols.push(PhpSymbol.create(SymbolKind.Interface, transforms[n].name));
            }
        }
    }

}

class InterfaceDeclarationHeaderTransform implements NodeTransform {
    phraseType = PhraseType.InterfaceDeclarationHeader;
    name = '';
    extends: PhpSymbol[];

    constructor() {
        this.extends = [];
    }

    push(transform: NodeTransform) {
        if (transform.tokenType === TokenType.Name) {
            this.name = (<TokenTransform>transform).text;
        } else if (transform.phraseType === PhraseType.InterfaceBaseClause) {
            this.extends = (<InterfaceBaseClauseTransform>transform).symbols;
        }
    }

}

class TraitUseClauseTransform implements SymbolsNodeTransform {

    phraseType = PhraseType.TraitUseClause;
    symbols: PhpSymbol[];

    constructor() {
        this.symbols = [];
    }

    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.QualifiedNameList) {
            let transforms = (<DelimiteredListTransform>transform).transforms as NameNodeTransform[];
            for (let n = 0; n < transforms.length; ++n) {
                this.symbols.push(PhpSymbol.create(SymbolKind.Trait, transforms[n].name));
            }
        }
    }

}

class ClassInterfaceClauseTransform implements SymbolsNodeTransform {
    phraseType = PhraseType.ClassInterfaceClause;
    symbols: PhpSymbol[];

    constructor() {
        this.symbols = [];
    }

    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.QualifiedNameList) {
            let transforms = (<DelimiteredListTransform>transform).transforms as NameNodeTransform[];
            for (let n = 0; n < transforms.length; ++n) {
                this.symbols.push(PhpSymbol.create(SymbolKind.Interface, transforms[n].name));
            }
        }
    }
}

class NamespaceDefinitionTransform implements SymbolNodeTransform {

    phraseType = PhraseType.NamespaceDefinition;
    private _symbol: PhpSymbol;
    private _children: UniqueSymbolCollection;

    constructor(location: HashedLocation) {
        this._symbol = PhpSymbol.create(SymbolKind.Namespace, '', location);
        this._children = new UniqueSymbolCollection();
    }

    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.NamespaceName) {
            this._symbol.name = (<NamespaceNameTransform>transform).text;
        } else {
            let s = (<SymbolNodeTransform>transform).symbol;
            if (s) {
                this._children.push(s);
                return;
            }

            let symbols = (<SymbolsNodeTransform>transform).symbols;
            if (symbols) {
                this._children.pushMany(symbols);
            }
        }
    }

    get symbol() {
        if (this._children.length > 0) {
            this._symbol.children = this._children.toArray();
        }

        return this._symbol;
    }
}

class ClassDeclarationTransform implements SymbolNodeTransform {

    phraseType = PhraseType.ClassDeclaration;
    symbol: PhpSymbol;

    constructor(public nameResolver: NameResolver, location: HashedLocation, doc: PhpDoc, docLocation: HashedLocation) {
        this.symbol = PhpSymbol.create(SymbolKind.Class, '', location);
        this.symbol.children = [];
        this.symbol.associated = [];
        SymbolReader.assignPhpDocInfoToSymbol(this.symbol, doc, docLocation, nameResolver);
    }

    push(transform: NodeTransform) {

        if (transform instanceof ClassDeclarationHeaderTransform) {
            this.symbol.modifiers = transform.modifier;
            this.symbol.name = this.nameResolver.resolveRelative(transform.name);
            if (transform.extends) {
                this.symbol.associated.push(transform.extends);
            }
            Array.prototype.push.apply(this.symbol.associated, transform.implements);
        } else if (transform.phraseType === PhraseType.ClassDeclarationBody) {
            Array.prototype.push.apply(this.symbol.children, PhpSymbol.setScope((<TypeDeclarationBodyTransform>transform).declarations, this.symbol.name));
            Array.prototype.push.apply(this.symbol.associated, (<TypeDeclarationBodyTransform>transform).useTraits);
        }

    }

}

class ClassDeclarationHeaderTransform implements NodeTransform {

    phraseType = PhraseType.ClassDeclarationHeader;
    modifier = SymbolModifier.None;
    name = '';
    extends: PhpSymbol;
    implements: PhpSymbol[];

    constructor() {
        this.implements = [];
    }

    push(transform: NodeTransform) {

        if (transform.tokenType === TokenType.Abstract) {
            this.modifier = SymbolModifier.Abstract;
        } else if (transform.tokenType === TokenType.Final) {
            this.modifier = SymbolModifier.Final;
        } else if (transform.tokenType === TokenType.Name) {
            this.name = (<TokenTransform>transform).text;
        } else if (transform.phraseType === PhraseType.ClassBaseClause) {
            this.extends = (<ClassBaseClauseTransform>transform).symbol;
        } else if (transform.phraseType === PhraseType.ClassInterfaceClause) {
            this.implements = (<ClassInterfaceClauseTransform>transform).symbols;
        }

    }

}

class ClassBaseClauseTransform implements SymbolNodeTransform {

    phraseType = PhraseType.ClassBaseClause;
    symbol: PhpSymbol;

    constructor() {
        this.symbol = PhpSymbol.create(SymbolKind.Class, '');
    }

    push(transform: NodeTransform) {
        switch (transform.phraseType) {
            case PhraseType.FullyQualifiedName:
            case PhraseType.RelativeQualifiedName:
            case PhraseType.QualifiedName:
                this.symbol.name = (<NameNodeTransform>transform).name;
                break;

            default:
                break;
        }
    }

}

class MemberModifierListTransform implements NodeTransform {

    phraseType = PhraseType.MemberModifierList;
    modifiers = SymbolModifier.None;

    push(transform: NodeTransform) {
        switch (transform.tokenType) {
            case TokenType.Public:
                this.modifiers |= SymbolModifier.Public;
                break;
            case TokenType.Protected:
                this.modifiers |= SymbolModifier.Protected;
                break;
            case TokenType.Private:
                this.modifiers |= SymbolModifier.Private;
                break;
            case TokenType.Abstract:
                this.modifiers |= SymbolModifier.Abstract;
                break;
            case TokenType.Final:
                this.modifiers |= SymbolModifier.Final;
                break;
            case TokenType.Static:
                this.modifiers |= SymbolModifier.Static;
                break;
            default:
                break;
        }
    }

}

class ClassConstantElementTransform implements SymbolNodeTransform {

    phraseType = PhraseType.ClassConstElement;
    symbol: PhpSymbol;
    private _docLocation: HashedLocation;
    private _doc: PhpDoc;

    constructor(public nameResolver: NameResolver, location: HashedLocation, doc: PhpDoc, docLocation: HashedLocation) {
        this.symbol = PhpSymbol.create(SymbolKind.ClassConstant, '', location);
        this.symbol.modifiers = SymbolModifier.Static;
        this._doc = doc;
        this._docLocation = docLocation;
    }

    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.Identifier) {
            this.symbol.name = (<IdentifierTransform>transform).text;
            SymbolReader.assignPhpDocInfoToSymbol(this.symbol, this._doc, this._docLocation, this.nameResolver)
        } else {
            this.symbol.value = (<TextNodeTransform>transform).text;
        }
    }

}

class MethodDeclarationTransform implements SymbolNodeTransform {

    phraseType = PhraseType.MethodDeclaration;
    private _children: UniqueSymbolCollection;
    private _symbol: PhpSymbol;

    constructor(public nameResolver: NameResolver, location: HashedLocation, doc: PhpDoc, docLocation: HashedLocation) {
        this._symbol = PhpSymbol.create(SymbolKind.Method, '', location);
        SymbolReader.assignPhpDocInfoToSymbol(this._symbol, doc, docLocation, nameResolver);
        this._children = new UniqueSymbolCollection();
    }

    push(transform: NodeTransform) {

        if (transform instanceof MethodDeclarationHeaderTransform) {
            this._symbol.modifiers = transform.modifiers;
            this._symbol.name = transform.name;
            this._children.pushMany(transform.parameters);
            this._symbol.type = transform.returnType;
        } else if (transform.phraseType === PhraseType.MethodDeclarationBody) {
            this._children.pushMany((<FunctionDeclarationBodyTransform>transform).symbols);
        }

    }

    get symbol() {
        this._symbol.children = PhpSymbol.setScope(this._children.toArray(), this._symbol.name);
        return this._symbol;
    }

}

class ReturnTypeTransform implements NodeTransform {

    phraseType = PhraseType.ReturnType;
    type = '';

    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.TypeDeclaration) {
            this.type = (<TypeDeclarationTransform>transform).type;
        }
    }

}

class TypeDeclarationTransform implements NodeTransform {

    phraseType = PhraseType.TypeDeclaration;
    type = '';
    private static _scalarTypes:{[name:string]:number} = { 'int': 1, 'string': 1, 'bool': 1, 'float': 1, 'iterable': 1 };

    push(transform: NodeTransform) {

        switch (transform.phraseType) {
            case PhraseType.FullyQualifiedName:
            case PhraseType.RelativeQualifiedName:
            case PhraseType.QualifiedName:
                if (TypeDeclarationTransform._scalarTypes[(<NameNodeTransform>transform).unresolved.toLowerCase()] === 1) {
                    this.type = (<NameNodeTransform>transform).unresolved;
                } else {
                    this.type = (<NameNodeTransform>transform).name;
                }
                break;

            case undefined:
                if (transform.tokenType === TokenType.Callable || transform.tokenType === TokenType.Array) {
                    this.type = (<TokenTransform>transform).text;
                }
                break;

            default:
                break;
        }

    }

}

class IdentifierTransform implements TextNodeTransform {

    phraseType = PhraseType.Identifier;
    text = '';
    push(transform: NodeTransform) {
        this.text = (<TokenTransform>transform).text;
    }

}

class MethodDeclarationHeaderTransform implements NodeTransform {

    phraseType = PhraseType.MethodDeclarationHeader;
    modifiers = SymbolModifier.Public;
    name = '';
    parameters: PhpSymbol[];
    returnType = '';

    constructor() {
        this.parameters = [];
    }

    push(transform: NodeTransform) {
        switch (transform.phraseType) {
            case PhraseType.MemberModifierList:
                this.modifiers = (<MemberModifierListTransform>transform).modifiers;
                if(!(this.modifiers & (SymbolModifier.Public | SymbolModifier.Protected | SymbolModifier.Private))) {
                    this.modifiers |= SymbolModifier.Public;
                }
                break;

            case PhraseType.Identifier:
                this.name = (<IdentifierTransform>transform).text;
                break;

            case PhraseType.ParameterDeclarationList:
                {
                    let transforms = (<DelimiteredListTransform>transform).transforms as ParameterDeclarationTransform[];
                    for (let n = 0; n < transforms.length; ++n) {
                        this.parameters.push(transforms[n].symbol);
                    }
                }
                break;

            case PhraseType.ReturnType:
                this.returnType = (<TypeDeclarationTransform>transform).type;
                break;

            default:
                break;
        }
    }

}

class PropertyInitialiserTransform implements NodeTransform {

    phraseType = PhraseType.PropertyInitialiser;
    text = '';

    push(transform: NodeTransform) {
        this.text = (<TextNodeTransform>transform).text;
    }

}

class PropertyElementTransform implements SymbolNodeTransform {

    phraseType = PhraseType.PropertyElement;
    symbol: PhpSymbol;
    private _doc: PhpDoc;
    private _docLocation: HashedLocation;

    constructor(public nameResolver: NameResolver, location: HashedLocation, doc: PhpDoc, docLocation: HashedLocation) {
        this.symbol = PhpSymbol.create(SymbolKind.Property, '', location);
        this._doc = doc;
        this._docLocation = docLocation;
    }

    push(transform: NodeTransform) {

        if (transform.tokenType === TokenType.VariableName) {
            this.symbol.name = (<TokenTransform>transform).text;
            SymbolReader.assignPhpDocInfoToSymbol(this.symbol, this._doc, this._docLocation, this.nameResolver)
        } else if (transform.phraseType === PhraseType.PropertyInitialiser) {
            this.symbol.value = (<PropertyInitialiserTransform>transform).text;
        }

    }

}

class FieldDeclarationTransform implements SymbolsNodeTransform {

    private _modifier = SymbolModifier.Public;
    symbols: PhpSymbol[];

    constructor(public phraseType: PhraseType) {
        this.symbols = [];
    }

    push(transform: NodeTransform) {
        if (transform.phraseType === PhraseType.MemberModifierList) {
            this._modifier = (<MemberModifierListTransform>transform).modifiers;
        } else if (
            transform.phraseType === PhraseType.PropertyElementList ||
            transform.phraseType === PhraseType.ClassConstElementList
        ) {
            let transforms = (<DelimiteredListTransform>transform).transforms as SymbolNodeTransform[];
            let s: PhpSymbol;
            for (let n = 0; n < transforms.length; ++n) {
                s = transforms[n].symbol;
                if (s) {
                    s.modifiers |= this._modifier;
                    this.symbols.push(s);
                }
            }
        }
    }

}

class FunctionDeclarationTransform implements SymbolNodeTransform {

    phraseType = PhraseType.FunctionDeclaration;
    private _symbol: PhpSymbol;
    private _children: UniqueSymbolCollection;

    constructor(public nameResolver: NameResolver, location: HashedLocation, phpDoc: PhpDoc, phpDocLocation: HashedLocation) {
        this._symbol = PhpSymbol.create(SymbolKind.Function, '', location);
        SymbolReader.assignPhpDocInfoToSymbol(this._symbol, phpDoc, phpDocLocation, nameResolver);
        this._children = new UniqueSymbolCollection();
    }

    push(transform: NodeTransform) {
        if (transform instanceof FunctionDeclarationHeaderTransform) {
            this._symbol.name = this.nameResolver.resolveRelative(transform.name);
            this._children.pushMany(transform.parameters);
            this._symbol.type = transform.returnType;
        } else if (transform.phraseType === PhraseType.FunctionDeclarationBody) {
            this._children.pushMany((<FunctionDeclarationBodyTransform>transform).symbols);
        }
    }

    get symbol() {
        this._symbol.children = PhpSymbol.setScope(this._children.toArray(), this._symbol.name);
        return this._symbol;
    }

}

class FunctionDeclarationHeaderTransform implements NodeTransform {

    phraseType = PhraseType.FunctionDeclarationHeader;
    name = '';
    parameters: PhpSymbol[];
    returnType = '';

    constructor() {
        this.parameters = [];
    }

    push(transform: NodeTransform) {

        if (transform.tokenType === TokenType.Name) {
            this.name = (<TokenTransform>transform).text;
        } else if (transform.phraseType === PhraseType.ParameterDeclarationList) {
            let transforms = (<DelimiteredListTransform>transform).transforms as SymbolNodeTransform[];
            for (let n = 0; n < transforms.length; ++n) {
                this.parameters.push(transforms[n].symbol);
            }
        } else if (transform.phraseType === PhraseType.ReturnType) {
            this.returnType = (<ReturnTypeTransform>transform).type;
        }
    }
}

class DefaultNodeTransform implements TextNodeTransform {

    constructor(public phraseType: PhraseType, public text: string) { }
    push(transform: NodeTransform) { }

}

export namespace SymbolReader {

    export function assignPhpDocInfoToSymbol(s: PhpSymbol, doc: PhpDoc, docLocation: HashedLocation, nameResolver: NameResolver) {

        if (!doc) {
            return s;
        }
        let tag: Tag;

        switch (s.kind) {
            case SymbolKind.Property:
            case SymbolKind.ClassConstant:
                tag = doc.findVarTag(s.name);
                if (tag) {
                    s.doc = PhpSymbolDoc.create(tag.description, TypeString.nameResolve(tag.typeString, nameResolver));
                }
                break;

            case SymbolKind.Method:
            case SymbolKind.Function:
                tag = doc.returnTag;
                s.doc = PhpSymbolDoc.create(doc.text);
                if (tag) {
                    s.doc.type = TypeString.nameResolve(tag.typeString, nameResolver);
                }
                break;

            case SymbolKind.Parameter:
                tag = doc.findParamTag(s.name);
                if (tag) {
                    s.doc = PhpSymbolDoc.create(tag.description, TypeString.nameResolve(tag.typeString, nameResolver));
                }
                break;

            case SymbolKind.Class:
            case SymbolKind.Trait:
            case SymbolKind.Interface:
                s.doc = PhpSymbolDoc.create(doc.text);
                if (!s.children) {
                    s.children = [];
                }
                Array.prototype.push.apply(s.children, phpDocMembers(doc, docLocation, nameResolver));
                break;

            default:
                break;

        }

        return s;

    }

    export function phpDocMembers(phpDoc: PhpDoc, phpDocLoc: HashedLocation, nameResolver: NameResolver) {

        let magic: Tag[] = phpDoc.propertyTags;
        let symbols: PhpSymbol[] = [];

        for (let n = 0, l = magic.length; n < l; ++n) {
            symbols.push(propertyTagToSymbol(magic[n], phpDocLoc, nameResolver));
        }

        magic = phpDoc.methodTags;
        for (let n = 0, l = magic.length; n < l; ++n) {
            symbols.push(methodTagToSymbol(magic[n], phpDocLoc, nameResolver));
        }

        return symbols;
    }

    function methodTagToSymbol(tag: Tag, phpDocLoc: HashedLocation, nameResolver: NameResolver) {

        let s = PhpSymbol.create(SymbolKind.Method, tag.name, phpDocLoc);
        s.modifiers = SymbolModifier.Magic | SymbolModifier.Public;
        s.doc = PhpSymbolDoc.create(tag.description, TypeString.nameResolve(tag.typeString, nameResolver));
        s.children = [];

        if(tag.isStatic) {
            s.modifiers |= SymbolModifier.Static;
        }

        if (!tag.parameters) {
            return s;
        }

        for (let n = 0, l = tag.parameters.length; n < l; ++n) {
            s.children.push(magicMethodParameterToSymbol(tag.parameters[n], phpDocLoc, nameResolver));
        }

        return s;
    }

    function magicMethodParameterToSymbol(p: MethodTagParam, phpDocLoc: HashedLocation, nameResolver: NameResolver) {

        let s = PhpSymbol.create(SymbolKind.Parameter, p.name, phpDocLoc);
        s.modifiers = SymbolModifier.Magic;
        s.doc = PhpSymbolDoc.create(undefined, TypeString.nameResolve(p.typeString, nameResolver));
        return s;

    }

    function propertyTagToSymbol(t: Tag, phpDocLoc: HashedLocation, nameResolver: NameResolver) {
        let s = PhpSymbol.create(SymbolKind.Property, t.name, phpDocLoc);
        s.modifiers = magicPropertyModifier(t) | SymbolModifier.Magic | SymbolModifier.Public;
        s.doc = PhpSymbolDoc.create(t.description, TypeString.nameResolve(t.typeString, nameResolver));
        return s;
    }

    function magicPropertyModifier(t: Tag) {
        switch (t.tagName) {
            case '@property-read':
                return SymbolModifier.ReadOnly;
            case '@property-write':
                return SymbolModifier.WriteOnly;
            default:
                return SymbolModifier.None;
        }
    }

    export function modifierListToSymbolModifier(phrase: Phrase) {

        if (!phrase) {
            return 0;
        }

        let flag = SymbolModifier.None;
        let tokens = phrase.children || [];

        for (let n = 0, l = tokens.length; n < l; ++n) {
            flag |= modifierTokenToSymbolModifier(<Token>tokens[n]);
        }

        return flag;
    }

    export function modifierTokenToSymbolModifier(t: Token) {
        switch (t.tokenType) {
            case TokenType.Public:
                return SymbolModifier.Public;
            case TokenType.Protected:
                return SymbolModifier.Protected;
            case TokenType.Private:
                return SymbolModifier.Private;
            case TokenType.Abstract:
                return SymbolModifier.Abstract;
            case TokenType.Final:
                return SymbolModifier.Final;
            case TokenType.Static:
                return SymbolModifier.Static;
            default:
                return SymbolModifier.None;
        }

    }

}

class NamespaceUseClauseListTransform implements SymbolsNodeTransform {

    symbols: PhpSymbol[];

    constructor(public phraseType: PhraseType) {
        this.symbols = [];
    }

    push(transform: NodeTransform) {
        if (
            transform.phraseType === PhraseType.NamespaceUseClause ||
            transform.phraseType === PhraseType.NamespaceUseGroupClause
        ) {
            this.symbols.push((<NamespaceUseClauseTransform>transform).symbol);
        }
    }

}

class NamespaceUseDeclarationTransform implements SymbolsNodeTransform {

    phraseType = PhraseType.NamespaceUseDeclaration;
    symbols: PhpSymbol[];
    private _kind = SymbolKind.Class;
    private _prefix = '';

    constructor() {
        this.symbols = [];
    }

    push(transform: NodeTransform) {
        if (transform.tokenType === TokenType.Const) {
            this._kind = SymbolKind.Constant;
        } else if (transform.tokenType === TokenType.Function) {
            this._kind = SymbolKind.Function;
        } else if (transform.phraseType === PhraseType.NamespaceName) {
            this._prefix = (<NamespaceNameTransform>transform).text;
        } else if (transform.phraseType === PhraseType.NamespaceUseGroupClauseList) {
            this.symbols = (<NamespaceUseClauseListTransform>transform).symbols;
            let s: PhpSymbol;
            let prefix = this._prefix ? this._prefix + '\\' : '';
            for (let n = 0; n < this.symbols.length; ++n) {
                s = this.symbols[n];
                s.associated[0].name = prefix + s.associated[0].name;
                if (!s.kind) {
                    s.kind = s.associated[0].kind = this._kind;
                }
            }
        } else if (transform.phraseType === PhraseType.NamespaceUseClauseList) {
            this.symbols = (<NamespaceUseClauseListTransform>transform).symbols;
            let s: PhpSymbol;
            for (let n = 0; n < this.symbols.length; ++n) {
                s = this.symbols[n];
                s.kind = s.associated[0].kind = this._kind;
            }
        }
    }

}

class NamespaceUseClauseTransform implements NodeTransform {

    symbol: PhpSymbol;

    constructor(public phraseType: PhraseType, location: HashedLocation) {
        this.symbol = PhpSymbol.create(0, '', location);
        this.symbol.modifiers = SymbolModifier.Use;
        this.symbol.associated = [];
    }

    push(transform: NodeTransform) {
        if (transform.tokenType === TokenType.Function) {
            this.symbol.kind = SymbolKind.Function;
        } else if (transform.tokenType === TokenType.Const) {
            this.symbol.kind = SymbolKind.Constant;
        } else if (transform.phraseType === PhraseType.NamespaceName) {
            let text = (<NamespaceNameTransform>transform).text;
            this.symbol.name = PhpSymbol.notFqn(text);
            this.symbol.associated.push(PhpSymbol.create(this.symbol.kind, text));
        } else if (transform.phraseType === PhraseType.NamespaceAliasingClause) {
            this.symbol.name = (<NamespaceAliasingClause>transform).text;
            this.symbol.location = (<NamespaceAliasingClause>transform).location;
        }
    }

}

class NamespaceAliasingClause implements TextNodeTransform {

    phraseType = PhraseType.NamespaceAliasingClause;
    text = '';
    location: HashedLocation;

    push(transform: NodeTransform) {
        if (transform.tokenType === TokenType.Name) {
            this.text = (<TokenTransform>transform).text;
            this.location = (<TokenTransform>transform).location;
        }
    }

}

