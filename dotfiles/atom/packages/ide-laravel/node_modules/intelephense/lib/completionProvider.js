'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const symbol_1 = require("./symbol");
const symbolReader_1 = require("./symbolReader");
const typeString_1 = require("./typeString");
const parsedDocument_1 = require("./parsedDocument");
const parseTreeTraverser_1 = require("./parseTreeTraverser");
const lsp = require("vscode-languageserver-types");
const util = require("./util");
const typeAggregate_1 = require("./typeAggregate");
const useDeclarationHelper_1 = require("./useDeclarationHelper");
const noCompletionResponse = {
    items: [],
    isIncomplete: false
};
function keywordCompletionItems(keywords, text) {
    let kw;
    let items = [];
    for (let n = 0, l = keywords.length; n < l; ++n) {
        kw = keywords[n];
        if (util.ciStringContains(text, kw)) {
            items.push({
                label: kw,
                kind: lsp.CompletionItemKind.Keyword
            });
        }
    }
    return items;
}
function symbolKindToLspSymbolKind(kind) {
    switch (kind) {
        case 1:
        case 4:
            return lsp.CompletionItemKind.Class;
        case 64:
            return lsp.CompletionItemKind.Function;
        case 32:
            return lsp.CompletionItemKind.Method;
        case 8:
        case 1024:
            return lsp.CompletionItemKind.Value;
        case 2:
            return lsp.CompletionItemKind.Interface;
        case 512:
            return lsp.CompletionItemKind.Module;
        case 2048:
            return lsp.CompletionItemKind.Constructor;
        case 16:
            return lsp.CompletionItemKind.Property;
        case 128:
        case 256:
            return lsp.CompletionItemKind.Variable;
        case 4096:
            return lsp.CompletionItemKind.File;
        default:
            return lsp.SymbolKind.String;
    }
}
const defaultCompletionOptions = {
    maxItems: 100,
    addUseDeclaration: true,
    backslashPrefix: true
};
const triggerParameterHintsCommand = {
    title: 'Trigger Parameter Hints',
    command: 'editor.action.triggerParameterHints'
};
class CompletionProvider {
    constructor(symbolStore, documentStore, refStore, config) {
        this.symbolStore = symbolStore;
        this.documentStore = documentStore;
        this.refStore = refStore;
        this._config = config ? config : CompletionProvider._defaultConfig;
        this._strategies = [
            new ClassTypeDesignatorCompletion(this._config, this.symbolStore),
            new ScopedAccessCompletion(this._config, this.symbolStore),
            new ObjectAccessCompletion(this._config, this.symbolStore),
            new SimpleVariableCompletion(this._config, this.symbolStore),
            new TypeDeclarationCompletion(this._config, this.symbolStore),
            new ClassBaseClauseCompletion(this._config, this.symbolStore),
            new InterfaceClauseCompletion(this._config, this.symbolStore),
            new TraitUseClauseCompletion(this._config, this.symbolStore),
            new NamespaceDefinitionCompletion(this._config, this.symbolStore),
            new NamespaceUseClauseCompletion(this._config, this.symbolStore),
            new NamespaceUseGroupClauseCompletion(this._config, this.symbolStore),
            new MethodDeclarationHeaderCompletion(this._config, this.symbolStore),
            new DeclarationBodyCompletion(this._config),
            new InstanceOfTypeDesignatorCompletion(this._config, this.symbolStore),
            new NameCompletion(this._config, this.symbolStore)
        ];
    }
    set config(config) {
        this._config = config;
        for (let n = 0, l = this._strategies.length; n < l; ++n) {
            this._strategies[n].config = config;
        }
    }
    provideCompletions(uri, position) {
        let doc = this.documentStore.find(uri);
        let table = this.symbolStore.getSymbolTable(uri);
        let refTable = this.refStore.getReferenceTable(uri);
        if (!doc || !table || !refTable) {
            return noCompletionResponse;
        }
        let traverser = new parseTreeTraverser_1.ParseTreeTraverser(doc, table, refTable);
        traverser.position(position);
        let t = traverser.node;
        if (!t || t.tokenType === 81) {
            return noCompletionResponse;
        }
        let offset = doc.offsetAtPosition(position);
        let word = doc.wordAtOffset(offset);
        let strategy = null;
        for (let n = 0, l = this._strategies.length; n < l; ++n) {
            if (this._strategies[n].canSuggest(traverser.clone())) {
                strategy = this._strategies[n];
                break;
            }
        }
        return strategy ? strategy.completions(traverser, word, doc.lineSubstring(offset)) : noCompletionResponse;
    }
}
CompletionProvider._defaultConfig = defaultCompletionOptions;
exports.CompletionProvider = CompletionProvider;
class AbstractNameCompletion {
    constructor(config, symbolStore) {
        this.config = config;
        this.symbolStore = symbolStore;
    }
    canSuggest(traverser) {
        if (parsedDocument_1.ParsedDocument.isToken(traverser.node, [147])) {
            traverser.prevToken();
        }
        return true;
    }
    completions(traverser, word, lineSubstring) {
        let items = [];
        let namePhrase = traverser.clone().ancestor(this._isNamePhrase);
        let nameResolver = traverser.nameResolver;
        if (!word || !namePhrase) {
            return noCompletionResponse;
        }
        let pred = this._symbolFilter;
        let addUseDeclarationEnabled = this.config.addUseDeclaration;
        let fqnOffset = 0;
        let isUnqualified = false;
        const useDeclarationHelper = new useDeclarationHelper_1.UseDeclarationHelper(traverser.document, traverser.symbolTable, traverser.range.start);
        const importMap = {};
        let qualifiedNameRule;
        if (namePhrase.phraseType === 144 ||
            namePhrase.phraseType === 84 ||
            word.indexOf('\\') > -1) {
            if (namePhrase.phraseType === 144) {
                word = nameResolver.resolveRelative(word.slice(10));
            }
            else if (namePhrase.phraseType === 141) {
                qualifiedNameRule = nameResolver.matchImportedSymbol(word.slice(0, word.indexOf('\\')), 1);
                word = nameResolver.resolveNotFullyQualified(word);
            }
            addUseDeclarationEnabled = false;
            fqnOffset = word.lastIndexOf('\\') + 1;
        }
        else {
            isUnqualified = true;
            const sf = pred;
            const isGlobalNs = nameResolver.namespaceName.length > 0;
            pred = x => {
                return sf(x) &&
                    (isGlobalNs || x.kind !== 512) &&
                    (x.kind === 512 || util.ciStringContains(word, symbol_1.PhpSymbol.notFqn(x.name)));
            };
            Array.prototype.push.apply(items, keywordCompletionItems(this._getKeywords(traverser.clone()), word));
            const imports = this._importedSymbols(nameResolver.rules, this._symbolFilter, word);
            let imported;
            for (let n = 0; n < imports.length; ++n) {
                imported = imports[n];
                if (imported.associated && imported.associated.length) {
                    importMap[imported.associated[0].name] = imported;
                }
                items.push(this._toCompletionItem(imports[n], useDeclarationHelper, nameResolver.namespaceName, isUnqualified, fqnOffset, qualifiedNameRule));
            }
        }
        const uniqueSymbols = new symbol_1.UniqueSymbolSet();
        const iterator = this.symbolStore.matchIterator(word, pred);
        let limit = this.config.maxItems;
        let isIncomplete = false;
        for (let s of iterator) {
            if (importMap[s.name] || uniqueSymbols.has(s)) {
                continue;
            }
            uniqueSymbols.add(s);
            items.push(this._toCompletionItem(s, useDeclarationHelper, nameResolver.namespaceName, isUnqualified, fqnOffset, qualifiedNameRule));
            if (items.length >= limit) {
                isIncomplete = true;
                break;
            }
        }
        return {
            items: items,
            isIncomplete: isIncomplete
        };
    }
    _useSymbolToUseDeclaration(s) {
        const fqn = s.associated[0].name;
        let decl = `use ${fqn}`;
        const slashPos = fqn.lastIndexOf('\\') + 1;
        if (fqn.slice(-s.name.length) !== s.name) {
            decl += ` as ${s.name}`;
        }
        return decl;
    }
    _importedSymbols(rules, pred, text) {
        let filteredRules = [];
        let r;
        for (let n = 0, l = rules.length; n < l; ++n) {
            r = rules[n];
            if (r.associated && r.associated.length > 0 && util.ciStringContains(text, r.name)) {
                filteredRules.push(r);
            }
        }
        let s;
        let merged;
        let imported = [];
        for (let n = 0, l = filteredRules.length; n < l; ++n) {
            r = filteredRules[n];
            s = this.symbolStore.find(r.associated[0].name, pred).shift();
            if (s) {
                merged = symbol_1.PhpSymbol.clone(s);
                merged.associated = r.associated;
                merged.modifiers |= 4096;
                merged.name = r.name;
                imported.push(merged);
            }
            else {
                merged = symbol_1.PhpSymbol.clone(r);
                merged.kind = 512;
                imported.push(merged);
            }
        }
        return imported;
    }
    _toCompletionItem(s, useDeclarationHelper, namespaceName, isUnqualified, fqnOffset, qualifiedNameRule) {
        const item = {
            kind: symbolKindToLspSymbolKind(s.kind),
            label: undefined
        };
        if (s.doc && s.doc.description) {
            item.documentation = s.doc.description;
        }
        const symbolNamespace = symbol_1.PhpSymbol.namespace(s.name);
        if (!isUnqualified) {
            item.label = s.name.slice(fqnOffset);
            if (qualifiedNameRule) {
                item.detail = this._useSymbolToUseDeclaration(qualifiedNameRule);
            }
        }
        else if ((s.modifiers & 4096) > 0) {
            item.detail = this._useSymbolToUseDeclaration(s);
            item.label = symbol_1.PhpSymbol.notFqn(s.name);
        }
        else if (s.kind === 512 || (!namespaceName && !symbolNamespace) || (s.kind === 8 && this._isMagicConstant(s.name))) {
            item.label = s.name;
        }
        else if (namespaceName === symbolNamespace) {
            item.detail = `namespace ${namespaceName}`;
            item.label = symbol_1.PhpSymbol.notFqn(s.name);
        }
        else if (namespaceName && !symbolNamespace) {
            item.label = s.name;
            if ((s.kind !== 8 && s.kind !== 64) || this.config.backslashPrefix) {
                item.insertText = '\\' + s.name;
            }
        }
        else if (this.config.addUseDeclaration && !useDeclarationHelper.findUseSymbolByName(s.name)) {
            item.label = symbol_1.PhpSymbol.notFqn(s.name);
            item.detail = `use ${s.name}`;
            item.additionalTextEdits = [useDeclarationHelper.insertDeclarationTextEdit(s)];
        }
        else {
            item.insertText = '\\' + s.name;
            item.detail = s.name;
        }
        if (s.kind === 64) {
            if (!item.insertText) {
                item.insertText = item.label;
            }
            item.detail = s.name + symbol_1.PhpSymbol.signatureString(s);
            if (symbol_1.PhpSymbol.hasParameters(s)) {
                item.insertText += '($0)';
                item.insertTextFormat = lsp.InsertTextFormat.Snippet;
                item.command = triggerParameterHintsCommand;
            }
            else {
                item.insertText += '()';
            }
        }
        else if (s.kind === 8) {
            if (s.value) {
                item.detail = `${s.name} = ${s.value}`;
            }
        }
        else {
        }
        return item;
    }
    _isMagicConstant(text) {
        switch (text) {
            case '__DIR__':
            case '__FILE__':
            case '__CLASS__':
            case '__LINE__':
            case '__FUNCTION__':
            case '__TRAIT__':
            case '__METHOD__':
            case '__NAMESPACE__':
                return true;
            default:
                return false;
        }
    }
    _isNamePhrase(node) {
        switch (node.phraseType) {
            case 141:
            case 84:
            case 144:
                return true;
            default:
                return false;
        }
    }
    _mergeSymbols(matches, imports) {
        let merged = imports.slice(0);
        let map = {};
        let imported;
        let s;
        for (let n = 0, l = imports.length; n < l; ++n) {
            imported = imports[n];
            if (imported.associated && imported.associated.length) {
                map[imported.associated[0].name] = imported;
            }
        }
        for (let n = 0, l = matches.length; n < l; ++n) {
            s = matches[n];
            imported = map[s.name];
            if (!imported) {
                merged.push(s);
            }
        }
        return merged;
    }
}
class InstanceOfTypeDesignatorCompletion extends AbstractNameCompletion {
    canSuggest(traverser) {
        super.canSuggest(traverser);
        return parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [121]) &&
            parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [84, 141, 144]) &&
            parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [101]);
    }
    _symbolFilter(s) {
        return (s.kind & (1 | 2 | 512)) > 0 && !(s.modifiers & (512));
    }
    _getKeywords(traverser) {
        return [];
    }
}
class ClassTypeDesignatorCompletion extends AbstractNameCompletion {
    canSuggest(traverser) {
        super.canSuggest(traverser);
        return parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [121]) &&
            parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [84, 141, 144]) &&
            parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [34]);
    }
    _symbolFilter(s) {
        return (s.kind & (1 | 512)) > 0 &&
            !(s.modifiers & (512 | 16));
    }
    _getKeywords(traverser) {
        if (traverser.ancestor(this._isQualifiedName)) {
            return ClassTypeDesignatorCompletion._keywords;
        }
        return [];
    }
    _toCompletionItem(s, useDeclarationHelper, namespaceName, isUnqualified, fqnOffset, qualifiedNameRule) {
        let item = super._toCompletionItem(s, useDeclarationHelper, namespaceName, isUnqualified, fqnOffset, qualifiedNameRule);
        let aggregate = new typeAggregate_1.TypeAggregate(this.symbolStore, s);
        let constructor = aggregate.firstMember(this._isConstructor);
        if (item.kind !== lsp.CompletionItemKind.Module) {
            item.kind = lsp.CompletionItemKind.Constructor;
        }
        if (constructor && symbol_1.PhpSymbol.hasParameters(constructor)) {
            if (!item.insertText) {
                item.insertText = item.label;
            }
            item.insertText += '($0)';
            item.insertTextFormat = lsp.InsertTextFormat.Snippet;
            item.command = triggerParameterHintsCommand;
        }
        return item;
    }
    _isConstructor(s) {
        return s.kind === 2048 || (s.kind === 32 && s.name.toLowerCase() === '__construct');
    }
    _isQualifiedName(node) {
        return node.phraseType === 141;
    }
}
ClassTypeDesignatorCompletion._keywords = [
    'class', 'static', 'namespace'
];
class SimpleVariableCompletion {
    constructor(config, symbolStore) {
        this.config = config;
        this.symbolStore = symbolStore;
    }
    canSuggest(traverser) {
        return parsedDocument_1.ParsedDocument.isToken(traverser.node, [90, 84]) &&
            parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [156]);
    }
    completions(traverser, word, lineSubstring) {
        if (!word) {
            return noCompletionResponse;
        }
        let scope = traverser.scope;
        let symbolMask = 256 | 128;
        let varSymbols = symbol_1.PhpSymbol.filterChildren(scope, (x) => {
            return (x.kind & symbolMask) > 0 && x.name.indexOf(word) === 0;
        });
        Array.prototype.push.apply(varSymbols, this.symbolStore.match(word, this._isBuiltInGlobalVar));
        let limit = Math.min(varSymbols.length, this.config.maxItems);
        let isIncomplete = varSymbols.length > this.config.maxItems;
        let items = [];
        let refScope = traverser.refTable.scopeAtPosition(scope.location.range.start);
        let varTable = this._varTypeMap(refScope);
        for (let n = 0; n < limit; ++n) {
            items.push(this._toVariableCompletionItem(varSymbols[n], varTable));
        }
        return {
            items: items,
            isIncomplete: isIncomplete
        };
    }
    _toVariableCompletionItem(s, varTable) {
        let item = {
            label: s.name,
            kind: lsp.CompletionItemKind.Variable,
            detail: varTable[s.name] || ''
        };
        if (s.doc && s.doc.description) {
            item.documentation = s.doc.description;
        }
        return item;
    }
    _varTypeMap(s) {
        let map = {};
        if (!s || !s.children) {
            return {};
        }
        let ref;
        for (let n = 0, l = s.children.length; n < l; ++n) {
            ref = s.children[n];
            if (ref.kind === 256 || ref.kind === 128) {
                map[ref.name] = typeString_1.TypeString.merge(map[ref.name], ref.type);
            }
        }
        return map;
    }
    _isBuiltInGlobalVar(s) {
        return s.kind === 256 && !s.location;
    }
}
class NameCompletion extends AbstractNameCompletion {
    canSuggest(traverser) {
        super.canSuggest(traverser);
        return parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [121]) &&
            traverser.ancestor(this._isNamePhrase) !== undefined;
    }
    completions(traverser, word, lineSubstring) {
        if (lineSubstring.slice(-3) === '<?p' ||
            lineSubstring.slice(-4) === '<?ph' ||
            lineSubstring.slice(-5) === '<?php') {
            return NameCompletion._openTagCompletion;
        }
        if (lineSubstring.match(NameCompletion._extendsOrImplementsRegexRegex)) {
            return lsp.CompletionList.create([
                { kind: lsp.CompletionItemKind.Keyword, label: 'extends' },
                { kind: lsp.CompletionItemKind.Keyword, label: 'implements' }
            ]);
        }
        if (lineSubstring.match(NameCompletion._implementsRegex)) {
            return lsp.CompletionList.create([{ kind: lsp.CompletionItemKind.Keyword, label: 'implements' }]);
        }
        return super.completions(traverser, word, lineSubstring);
    }
    _getKeywords(traverser) {
        let kw = [];
        Array.prototype.push.apply(kw, NameCompletion._expressionKeywords);
        Array.prototype.push.apply(kw, NameCompletion._statementKeywords);
        return kw;
    }
    _symbolFilter(s) {
        return (s.kind & (1 | 64 | 8 | 512)) > 0 &&
            !(s.modifiers & 512);
    }
}
NameCompletion._statementKeywords = [
    '__halt_compiler',
    'abstract',
    'break',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'declare',
    'default',
    'die',
    'do',
    'echo',
    'else',
    'elseif',
    'enddeclare',
    'endfor',
    'endforeach',
    'endif',
    'endswitch',
    'endwhile',
    'final',
    'finally',
    'for',
    'foreach',
    'function',
    'global',
    'goto',
    'if',
    'interface',
    'list',
    'namespace',
    'return',
    'static',
    'switch',
    'throw',
    'trait',
    'try',
    'unset',
    'use',
    'while'
];
NameCompletion._expressionKeywords = [
    'array',
    'clone',
    'empty',
    'eval',
    'exit',
    'function',
    'include',
    'include_once',
    'isset',
    'new',
    'parent',
    'print',
    'require',
    'require_once',
    'static',
    'yield',
    'as',
    'self'
];
NameCompletion._openTagCompletion = {
    isIncomplete: false,
    items: [{
            kind: lsp.CompletionItemKind.Keyword,
            label: '<?php',
            insertText: 'php'
        }]
};
NameCompletion._extendsOrImplementsRegexRegex = /\b(?:class|interface)\s+[a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*\s+[a-z]+$/;
NameCompletion._implementsRegex = /\bclass\s+[a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*(?:\s+extends\s+[a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*)?\s+[a-z]+$/;
class MemberAccessCompletion {
    constructor(config, symbolStore) {
        this.config = config;
        this.symbolStore = symbolStore;
    }
    completions(traverser, word) {
        let scopedAccessExpr = traverser.ancestor(this._isMemberAccessExpr);
        let scopePhrase = traverser.nthChild(0);
        let type = this._resolveType(traverser);
        let typeNames = typeString_1.TypeString.atomicClassArray(type);
        if (!typeNames.length) {
            return noCompletionResponse;
        }
        let nameResolver = traverser.nameResolver;
        let classAggregateType = typeAggregate_1.TypeAggregate.create(this.symbolStore, nameResolver.className);
        let typeName;
        let fn;
        let typeAggregate;
        let symbols = [];
        for (let n = 0, l = typeNames.length; n < l; ++n) {
            typeName = typeNames[n];
            if (classAggregateType && classAggregateType.name.toLowerCase() === typeName.toLowerCase()) {
                typeAggregate = classAggregateType;
            }
            else {
                typeAggregate = typeAggregate_1.TypeAggregate.create(this.symbolStore, typeName);
            }
            if (!typeAggregate) {
                continue;
            }
            fn = this._createMemberPredicate(typeName, word, classAggregateType);
            Array.prototype.push.apply(symbols, typeAggregate.members(2, fn));
        }
        symbols = Array.from(new Set(symbols));
        let isIncomplete = symbols.length > this.config.maxItems;
        let limit = Math.min(symbols.length, this.config.maxItems);
        let items = [];
        for (let n = 0; n < limit; ++n) {
            items.push(this._toCompletionItem(symbols[n]));
        }
        return {
            isIncomplete: isIncomplete,
            items: items
        };
    }
    _resolveType(traverser) {
        let node;
        let arrayDereference = 0;
        let ref;
        while (true) {
            node = traverser.node;
            switch (node.phraseType) {
                case 84:
                case 144:
                case 141:
                case 156:
                case 145:
                    ref = traverser.reference;
                    break;
                case 112:
                case 136:
                case 150:
                case 152:
                case 24:
                    if (traverser.child(this._isMemberName)) {
                        ref = traverser.reference;
                    }
                    break;
                case 56:
                    if (traverser.child(parsedDocument_1.ParsedDocument.isPhrase)) {
                        continue;
                    }
                    break;
                case 128:
                    if (traverser.child(this._isClassTypeDesignator) && traverser.child(parsedDocument_1.ParsedDocument.isNamePhrase)) {
                        ref = traverser.reference;
                    }
                    break;
                case 155:
                case 16:
                    if (traverser.nthChild(0)) {
                        continue;
                    }
                    break;
                case 85:
                    if (traverser.nthChild(0)) {
                        ref = traverser.reference;
                    }
                    break;
                case 160:
                    if (traverser.nthChild(0)) {
                        arrayDereference++;
                        continue;
                    }
                    break;
                default:
                    break;
            }
            break;
        }
        if (!ref) {
            return '';
        }
        let type = this.symbolStore.referenceToTypeString(ref);
        while (arrayDereference--) {
            type = typeString_1.TypeString.arrayDereference(type);
        }
        return type;
    }
    _isMemberAccessExpr(node) {
        switch (node.phraseType) {
            case 150:
            case 65:
            case 24:
            case 152:
            case 136:
            case 112:
                return true;
            default:
                return false;
        }
    }
    _toCompletionItem(s) {
        switch (s.kind) {
            case 1024:
                return this.toClassConstantCompletionItem(s);
            case 32:
                return this.toMethodCompletionItem(s);
            case 16:
                return this.toPropertyCompletionItem(s);
            default:
                throw Error('Invalid Argument');
        }
    }
    toMethodCompletionItem(s) {
        let item = {
            kind: lsp.CompletionItemKind.Method,
            label: s.name,
            detail: s.name + symbol_1.PhpSymbol.signatureString(s)
        };
        if (s.doc && s.doc.description) {
            item.documentation = s.doc.description;
        }
        if (s.name.slice(0, 2) === '__') {
            item.sortText = 'zzz';
        }
        else {
            item.sortText = item.label;
        }
        if (symbol_1.PhpSymbol.hasParameters(s)) {
            item.insertText = s.name + '($0)';
            item.insertTextFormat = lsp.InsertTextFormat.Snippet;
            item.command = triggerParameterHintsCommand;
        }
        else {
            item.insertText = s.name + '()';
        }
        return item;
    }
    toClassConstantCompletionItem(s) {
        let item = {
            kind: lsp.CompletionItemKind.Value,
            label: s.name,
        };
        if (s.doc && s.doc.description) {
            item.documentation = s.doc.description;
        }
        if (s.value) {
            item.detail = `${s.name} = ${s.value}`;
        }
        return item;
    }
    toPropertyCompletionItem(s) {
        let item = {
            kind: lsp.CompletionItemKind.Property,
            label: (s.modifiers & 32) > 0 ? s.name : s.name.slice(1),
            detail: symbol_1.PhpSymbol.type(s)
        };
        if (s.doc && s.doc.description) {
            item.documentation = s.doc.description;
        }
        return item;
    }
    _isMemberName(node) {
        return node.phraseType === 111 || node.phraseType === 151;
    }
    _isClassTypeDesignator(node) {
        return node.phraseType === 34;
    }
}
class ScopedAccessCompletion extends MemberAccessCompletion {
    canSuggest(traverser) {
        const scopedAccessPhrases = [
            150,
            65,
            24,
            152
        ];
        if (parsedDocument_1.ParsedDocument.isToken(traverser.node, [133])) {
            return parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), scopedAccessPhrases);
        }
        if (parsedDocument_1.ParsedDocument.isToken(traverser.node, [84])) {
            return parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [151]);
        }
        if (parsedDocument_1.ParsedDocument.isToken(traverser.node, [90])) {
            return parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [156]) &&
                parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [151]);
        }
        return parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [95]) &&
            parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [151]);
    }
    _createMemberPredicate(scopeName, word, classContext) {
        if (classContext && scopeName.toLowerCase() === classContext.name.toLowerCase()) {
            return (x) => {
                return (x.modifiers & 32) > 0 && util.ciStringContains(word, x.name);
            };
        }
        else if (classContext && classContext.isBaseClass(scopeName)) {
            return (x) => {
                return !(x.modifiers & 4) && util.ciStringContains(word, x.name);
            };
        }
        else if (classContext && classContext.isAssociated(scopeName)) {
            return (x) => {
                return (x.modifiers & 32) > 0 &&
                    !(x.modifiers & 4) &&
                    util.ciStringContains(word, x.name);
            };
        }
        else {
            const mask = 32 | 1;
            return (x) => {
                return (x.modifiers & mask) === mask && util.ciStringContains(word, x.name);
            };
        }
    }
}
class ObjectAccessCompletion extends MemberAccessCompletion {
    canSuggest(traverser) {
        if (parsedDocument_1.ParsedDocument.isToken(traverser.node, [115])) {
            return parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [136, 112]);
        }
        return parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [111]);
    }
    _createMemberPredicate(scopeName, word, classContext) {
        if (classContext && scopeName.toLowerCase() === classContext.name.toLowerCase()) {
            return (x) => {
                return util.ciStringContains(word, x.name);
            };
        }
        else if (classContext && classContext.isAssociated(scopeName)) {
            const mask = 4;
            return (x) => {
                return !(x.modifiers & mask) && util.ciStringContains(word, x.name);
            };
        }
        else {
            const mask = 2 | 4;
            return (x) => {
                return !(x.modifiers & mask) && util.ciStringContains(word, x.name);
            };
        }
    }
}
class TypeDeclarationCompletion extends AbstractNameCompletion {
    canSuggest(traverser) {
        super.canSuggest(traverser);
        return parsedDocument_1.ParsedDocument.isToken(traverser.node, [83, 147, 3, 6]) &&
            traverser.ancestor(this._isTypeDeclaration) !== undefined;
    }
    _getKeywords(traverser) {
        return TypeDeclarationCompletion._keywords;
    }
    _symbolFilter(s) {
        return (s.kind & (1 | 2 | 512)) > 0;
    }
    _isTypeDeclaration(node) {
        return node.phraseType === 173;
    }
}
TypeDeclarationCompletion._keywords = [
    'self', 'array', 'callable', 'bool', 'float', 'int', 'string'
];
class ClassBaseClauseCompletion extends AbstractNameCompletion {
    canSuggest(traverser) {
        super.canSuggest(traverser);
        return traverser.ancestor(this._isClassBaseClause) !== undefined;
    }
    _getKeywords(traverser) {
        return [];
    }
    _symbolFilter(s) {
        return (s.kind & (1 | 512)) > 0 && !(s.modifiers & 8);
    }
    _isClassBaseClause(node) {
        return node.phraseType === 23;
    }
}
class InterfaceClauseCompletion extends AbstractNameCompletion {
    canSuggest(traverser) {
        super.canSuggest(traverser);
        return traverser.ancestor(this._isInterfaceClause) !== undefined;
    }
    _getKeywords(traverser) {
        return [];
    }
    _symbolFilter(s) {
        return s.kind === 2 || s.kind === 512;
    }
    _isInterfaceClause(node) {
        return node.phraseType === 31 ||
            node.phraseType === 102;
    }
}
class TraitUseClauseCompletion extends AbstractNameCompletion {
    canSuggest(traverser) {
        super.canSuggest(traverser);
        return traverser.ancestor(this._isNamePhrase) &&
            parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [142]) &&
            parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [170]);
    }
    _getKeywords(traverser) {
        return [];
    }
    _symbolFilter(s) {
        return s.kind === 4 || s.kind === 512;
    }
}
class NamespaceDefinitionCompletion {
    constructor(config, symbolStore) {
        this.config = config;
        this.symbolStore = symbolStore;
    }
    canSuggest(traverser) {
        if (parsedDocument_1.ParsedDocument.isToken(traverser.node, [147])) {
            traverser.prevToken();
        }
        return traverser.ancestor(this._isNamespaceDefinition) !== undefined;
    }
    completions(traverser, word) {
        const items = [];
        const uniqueSymbols = new symbol_1.UniqueSymbolSet();
        const matches = this.symbolStore.matchIterator(word, this._symbolFilter);
        let isIncomplete = false;
        let n = this.config.maxItems;
        const fqnOffset = word.lastIndexOf('\\') + 1;
        for (let s of matches) {
            if (uniqueSymbols.has(s)) {
                continue;
            }
            uniqueSymbols.add(s);
            items.push({
                label: s.name.slice(fqnOffset),
                kind: lsp.CompletionItemKind.Module
            });
            --n;
            if (n < 1) {
                isIncomplete = true;
                break;
            }
        }
        return {
            items: items,
            isIncomplete: isIncomplete
        };
    }
    _toNamespaceCompletionItem(s) {
        return {
            label: s.name,
            kind: lsp.CompletionItemKind.Module
        };
    }
    _symbolFilter(s) {
        return s.kind === 512;
    }
    _isNamespaceDefinition(node) {
        return node.phraseType === 120;
    }
}
class NamespaceUseClauseCompletion {
    constructor(config, symbolStore) {
        this.config = config;
        this.symbolStore = symbolStore;
    }
    canSuggest(traverser) {
        if (parsedDocument_1.ParsedDocument.isToken(traverser.node, [147])) {
            traverser.prevToken();
        }
        return parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [121]) &&
            parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [124, 122]);
    }
    completions(traverser, word) {
        let items = [];
        let namespaceUseDecl = traverser.ancestor(this._isNamespaceUseDeclaration);
        if (!word) {
            return noCompletionResponse;
        }
        const kindMask = this._modifierToSymbolKind(traverser.child(this._isModifier));
        const pred = (x) => {
            return (x.kind & kindMask) > 0 && !(x.modifiers & 4096);
        };
        const matches = this.symbolStore.matchIterator(word, pred);
        const uniqueSymbols = new symbol_1.UniqueSymbolSet();
        let n = this.config.maxItems;
        let isIncomplete = false;
        const fqnOffset = word.lastIndexOf('\\') + 1;
        const lcWord = word.toLowerCase();
        for (let s of matches) {
            if (uniqueSymbols.has(s)) {
                continue;
            }
            uniqueSymbols.add(s);
            items.push(this._toCompletionItem(s, lcWord, fqnOffset));
            if (--n < 1) {
                isIncomplete = true;
                break;
            }
        }
        return {
            isIncomplete: isIncomplete,
            items: items
        };
    }
    _toCompletionItem(s, lcWord, fqnOffset) {
        const didMatchOnFqn = s.name.slice(0, lcWord.length).toLowerCase() === lcWord;
        let item = {
            kind: symbolKindToLspSymbolKind(s.kind),
            label: didMatchOnFqn ? s.name.slice(fqnOffset) : symbol_1.PhpSymbol.notFqn(s.name)
        };
        if (s.kind !== 512 && !didMatchOnFqn) {
            item.detail = s.name;
            item.insertText = s.name;
        }
        if (s.doc && s.doc.description) {
            item.documentation = s.doc.description;
        }
        return item;
    }
    _isNamespaceUseDeclaration(node) {
        return node.phraseType === 124;
    }
    _isNamespaceUseClause(node) {
        return node.phraseType === 122;
    }
    _modifierToSymbolKind(token) {
        const defaultKindMask = 1 | 2 | 4 | 512;
        if (!token) {
            return defaultKindMask;
        }
        switch (token.tokenType) {
            case 35:
                return 64 | 512;
            case 12:
                return 8 | 512;
            default:
                return defaultKindMask;
        }
    }
    _isModifier(node) {
        switch (node.tokenType) {
            case 9:
            case 35:
            case 12:
                return true;
            default:
                return false;
        }
    }
}
class NamespaceUseGroupClauseCompletion {
    constructor(config, symbolStore) {
        this.config = config;
        this.symbolStore = symbolStore;
    }
    canSuggest(traverser) {
        if (parsedDocument_1.ParsedDocument.isToken(traverser.node, [147])) {
            traverser.prevToken();
        }
        return parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [121]) &&
            parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [125]);
    }
    completions(traverser, word) {
        let items = [];
        if (!word) {
            return noCompletionResponse;
        }
        let nsUseGroupClause = traverser.ancestor(this._isNamespaceUseGroupClause);
        let nsUseGroupClauseModifier = traverser.child(this._isModifier);
        let nsUseDecl = traverser.ancestor(this._isNamespaceUseDeclaration);
        let nsUseDeclModifier = traverser.child(this._isModifier);
        let kindMask = this._modifierToSymbolKind(nsUseGroupClauseModifier || nsUseDeclModifier);
        let prefix = '';
        if (nsUseDeclModifier) {
            traverser.parent();
        }
        if (traverser.child(this._isNamespaceName)) {
            prefix = traverser.text;
        }
        word = prefix + '\\' + word;
        let pred = (x) => {
            return (x.kind & kindMask) > 0 && !(x.modifiers & 4096);
        };
        let matches = this.symbolStore.matchIterator(word, pred);
        let uniqueSymbols = new symbol_1.UniqueSymbolSet();
        let isIncomplete = false;
        let n = this.config.maxItems;
        const fqnOffset = word.lastIndexOf('\\') + 1;
        for (let s of matches) {
            if (uniqueSymbols.has(s)) {
                continue;
            }
            uniqueSymbols.add(s);
            items.push(this._toCompletionItem(s, fqnOffset));
            if (--n < 1) {
                isIncomplete = true;
                break;
            }
        }
        return {
            isIncomplete: isIncomplete,
            items: items
        };
    }
    _toCompletionItem(s, fqnOffset) {
        let item = {
            kind: symbolKindToLspSymbolKind(s.kind),
            label: s.name.slice(fqnOffset)
        };
        if (s.doc && s.doc.description) {
            item.documentation = s.doc.description;
        }
        return item;
    }
    _isNamespaceUseGroupClause(node) {
        return node.phraseType === 125;
    }
    _isNamespaceUseDeclaration(node) {
        return node.phraseType === 124;
    }
    _isModifier(node) {
        switch (node.tokenType) {
            case 9:
            case 35:
            case 12:
                return true;
            default:
                return false;
        }
    }
    _isNamespaceName(node) {
        return node.phraseType === 121;
    }
    _modifierToSymbolKind(modifier) {
        const defaultKindMask = 1 | 2 | 4 | 512;
        if (!modifier) {
            return defaultKindMask;
        }
        switch (modifier.tokenType) {
            case 35:
                return 64 | 512;
            case 12:
                return 8 | 512;
            default:
                return defaultKindMask;
        }
    }
}
class DeclarationBodyCompletion {
    constructor(config) {
        this.config = config;
    }
    canSuggest(traverser) {
        return parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), DeclarationBodyCompletion._phraseTypes) ||
            (parsedDocument_1.ParsedDocument.isPhrase(traverser.node, [60]) && parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), DeclarationBodyCompletion._phraseTypes));
    }
    completions(traverser, word) {
        return {
            items: keywordCompletionItems(DeclarationBodyCompletion._keywords, word)
        };
    }
}
DeclarationBodyCompletion._phraseTypes = [
    29, 104, 166,
    61
];
DeclarationBodyCompletion._keywords = [
    'var', 'public', 'private', 'protected', 'final', 'function', 'abstract', 'use'
];
class MethodDeclarationHeaderCompletion {
    constructor(config, symbolStore) {
        this.config = config;
        this.symbolStore = symbolStore;
    }
    canSuggest(traverser) {
        let nameResolver = traverser.nameResolver;
        let thisSymbol = nameResolver.class;
        return parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [95]) &&
            parsedDocument_1.ParsedDocument.isPhrase(traverser.parent(), [115]) &&
            thisSymbol !== undefined;
    }
    completions(traverser, word) {
        let memberDecl = traverser.ancestor(this._isMethodDeclarationHeader);
        let modifiers = symbolReader_1.SymbolReader.modifierListToSymbolModifier(traverser.child(this._isMemberModifierList));
        if (modifiers & (4 | 16)) {
            return noCompletionResponse;
        }
        modifiers &= (1 | 2);
        let nameResolver = traverser.nameResolver;
        let classSymbol = nameResolver.class;
        let existingMethods = symbol_1.PhpSymbol.filterChildren(classSymbol, this._isMethod);
        let existingMethodNames = new Set(existingMethods.map(this._toName));
        let fn = (x) => {
            return x.kind === 32 &&
                (!modifiers || (x.modifiers & modifiers) > 0) &&
                !(x.modifiers & (8 | 4)) &&
                !existingMethodNames.has(x.name.toLowerCase()) &&
                util.ciStringContains(word, x.name);
        };
        const aggregate = new typeAggregate_1.TypeAggregate(this.symbolStore, classSymbol, true);
        const matches = aggregate.members(2, fn);
        let isIncomplete = matches.length > this.config.maxItems;
        const limit = Math.min(this.config.maxItems, matches.length);
        const items = [];
        let s;
        for (let n = 0; n < limit; ++n) {
            s = matches[n];
            if (s.name && s.name[0] === '_') {
                existingMethodNames.add(s.name);
            }
            items.push(this._toCompletionItem(s));
        }
        Array.prototype.push.apply(items, this._magicMethodCompletionItems(word, existingMethodNames));
        return {
            isIncomplete: isIncomplete,
            items: items
        };
    }
    _magicMethodCompletionItems(word, excludeSet) {
        let name;
        const items = [];
        const keys = Object.keys(MethodDeclarationHeaderCompletion.MAGIC_METHODS);
        for (let n = 0; n < keys.length; ++n) {
            name = keys[n];
            if (!util.ciStringContains(word, name) || excludeSet.has(name)) {
                continue;
            }
            items.push({
                kind: lsp.CompletionItemKind.Method,
                label: name,
                insertText: MethodDeclarationHeaderCompletion.MAGIC_METHODS[name],
                insertTextFormat: lsp.InsertTextFormat.Snippet,
            });
        }
        return items;
    }
    _toCompletionItem(s) {
        let params = symbol_1.PhpSymbol.filterChildren(s, this._isParameter);
        let paramStrings = [];
        for (let n = 0, l = params.length; n < l; ++n) {
            paramStrings.push(this._parameterToString(params[n]));
        }
        let paramString = paramStrings.join(', ');
        let escapedParamString = snippetEscape(paramString);
        let insertText = `${s.name}(${escapedParamString})${snippetEscape(this._returnType(s))}\n{\n\t$0\n\\}`;
        let item = {
            kind: lsp.CompletionItemKind.Method,
            label: s.name,
            insertText: insertText,
            insertTextFormat: lsp.InsertTextFormat.Snippet,
            detail: `${s.scope}::${s.name}`
        };
        if (s.doc && s.doc.description) {
            item.documentation = s.doc.description;
        }
        return item;
    }
    _returnType(s) {
        if (s.type) {
            return `: ${s.type}`;
        }
        else {
            return '';
        }
    }
    _parameterToString(s) {
        let parts = [];
        if (s.type) {
            let typeName = typeString_1.TypeString.atomicClassArray(s.type).shift();
            if (typeName) {
                typeName = '\\' + typeName;
            }
            else {
                typeName = s.type;
            }
            parts.push(typeName);
        }
        parts.push(s.name);
        if (s.value) {
            parts.push(`= ${s.value}`);
        }
        return parts.join(' ');
    }
    _isMethodDeclarationHeader(node) {
        return node.phraseType === 115;
    }
    _isMemberModifierList(node) {
        return node.phraseType === 110;
    }
    _isMethod(s) {
        return s.kind === 32;
    }
    _toName(s) {
        return s.name.toLowerCase();
    }
    _isParameter(s) {
        return s.kind === 128;
    }
}
MethodDeclarationHeaderCompletion.MAGIC_METHODS = {
    '__construct': `__construct($1)\n{\n\t$0\n\\}`,
    '__destruct': `__destruct()\n{\n\t$0\n\\}`,
    '__call': `__call(\\$name, \\$arguments)\n{\n\t$0\n\\}`,
    '__callStatic': `__callStatic(\\$name, \\$arguments)\n{\n\t$0\n\\}`,
    '__get': `__get(\\$name)\n{\n\t$0\n\\}`,
    '__set': `__set(\\$name, \\$value)\n{\n\t$0\n\\}`,
    '__isset': `__isset(\\$name)\n{\n\t$0\n\\}`,
    '__unset': `__unset(\\$name)\n{\n\t$0\n\\}`,
    '__sleep': `__sleep()\n{\n\t$0\n\\}`,
    '__wakeup': `__wakeup()\n{\n\t$0\n\\}`,
    '__toString': `__toString()\n{\n\t$0\n\\}`,
    '__invoke': `__invoke($1)\n{\n\t$0\n\\}`,
    '__set_state': `__set_state(\\$properties)\n{\n\t$0\n\\}`,
    '__clone': `__clone()\n{\n\t$0\n\\}`,
    '__debugInfo': `__debugInfo()\n{\n\t$0\n\\}`
};
const snippetEscapeRegex = /[$}\\]/g;
function snippetEscape(text) {
    return text.replace(snippetEscapeRegex, snippetEscapeReplacer);
}
function snippetEscapeReplacer(match, offset, subject) {
    return '\\' + match;
}
