'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const lsp = require("vscode-languageserver-types");
const parsedDocument_1 = require("./parsedDocument");
class FormatProvider {
    constructor(docStore) {
        this.docStore = docStore;
    }
    provideDocumentFormattingEdits(doc, formatOptions) {
        let parsedDoc = this.docStore.find(doc.uri);
        if (!parsedDoc) {
            return [];
        }
        let visitor = new FormatVisitor(parsedDoc, formatOptions);
        parsedDoc.traverse(visitor);
        let edits = visitor.edits;
        let text = parsedDoc.text;
        if (visitor.firstToken &&
            visitor.firstToken.tokenType === 156 &&
            visitor.OpenTagCount === 1) {
            let closeTagIndex = visitor.last3Tokens.findIndex(this._isCloseTag);
            let endEdit;
            let lastToken = visitor.last3Tokens.length ? visitor.last3Tokens[visitor.last3Tokens.length - 1] : undefined;
            let lastTokenText = parsedDoc.tokenText(lastToken);
            if (closeTagIndex < 0) {
                if (lastToken && lastToken.tokenType === 161 && lastTokenText.search(FormatProvider.blkLinePattern) < 0) {
                    endEdit = lsp.TextEdit.replace(parsedDoc.tokenRange(lastToken), '\n\n');
                }
                else if (lastToken && lastToken.tokenType !== 161) {
                    endEdit = lsp.TextEdit.insert(parsedDoc.tokenRange(lastToken).end, '\n\n');
                }
            }
            else if (closeTagIndex > 0 && (lastToken.tokenType === 158 || (lastToken.tokenType === 81 && !lastTokenText.trim()))) {
                let tokenBeforeClose = visitor.last3Tokens[closeTagIndex - 1];
                let replaceStart;
                if (tokenBeforeClose.tokenType === 161) {
                    replaceStart = parsedDoc.tokenRange(tokenBeforeClose).start;
                }
                else {
                    replaceStart = parsedDoc.tokenRange(visitor.last3Tokens[closeTagIndex]).start;
                }
                endEdit = lsp.TextEdit.replace({ start: replaceStart, end: parsedDoc.tokenRange(lastToken).end }, '\n\n');
                if (edits.length) {
                    let lastEdit = edits[edits.length - 1];
                    if (lastEdit.range.end.line > endEdit.range.start.line ||
                        (lastEdit.range.end.line === endEdit.range.start.line && lastEdit.range.end.character > endEdit.range.start.character)) {
                        edits.shift();
                    }
                }
            }
            if (endEdit) {
                edits.unshift(endEdit);
            }
        }
        return edits;
    }
    provideDocumentRangeFormattingEdits(doc, range, formatOptions) {
        let parsedDoc = this.docStore.find(doc.uri);
        if (!parsedDoc) {
            return [];
        }
        let visitor = new FormatVisitor(parsedDoc, formatOptions, range);
        parsedDoc.traverse(visitor);
        return visitor.edits;
    }
    _isCloseTag(t) {
        return t.tokenType === 158;
    }
}
FormatProvider.blkLinePattern = /^(\r\n|\r|\n){2}$/;
exports.FormatProvider = FormatProvider;
class FormatVisitor {
    constructor(doc, formatOptions, range) {
        this.doc = doc;
        this.formatOptions = formatOptions;
        this._indentText = '';
        this._startOffset = -1;
        this._endOffset = -1;
        this._active = true;
        this._lastParameterListWasMultiLine = false;
        this.OpenTagCount = 0;
        this._edits = [];
        this._isMultilineCommaDelimitedListStack = [];
        this._indentUnit = formatOptions.insertSpaces ? FormatVisitor.createWhitespace(formatOptions.tabSize, ' ') : '\t';
        if (range) {
            this._startOffset = this.doc.offsetAtPosition(range.start);
            this._endOffset = this.doc.offsetAtPosition(range.end);
            this._active = false;
        }
        this.last3Tokens = [];
        this._decrementOnTheseNodes = [];
    }
    get edits() {
        return this._edits.reverse();
    }
    preorder(node, spine) {
        let parent = spine.length ? spine[spine.length - 1] : { phraseType: 0, children: [] };
        switch (node.phraseType) {
            case 87:
                if (parent.phraseType === 4 || this._lastParameterListWasMultiLine) {
                    this._nextFormatRule = FormatVisitor.singleSpaceBefore;
                    this._lastParameterListWasMultiLine = false;
                }
                else {
                    this._nextFormatRule = FormatVisitor.newlineIndentBefore;
                }
                return true;
            case 114:
                if (this._lastParameterListWasMultiLine) {
                    this._nextFormatRule = FormatVisitor.singleSpaceBefore;
                    this._lastParameterListWasMultiLine = false;
                }
                else {
                    this._nextFormatRule = FormatVisitor.newlineIndentBefore;
                }
                return true;
            case 29:
            case 166:
            case 104:
                this._nextFormatRule = FormatVisitor.newlineIndentBefore;
                return true;
            case 130:
            case 8:
            case 36:
            case 11:
            case 142:
                if ((this._previousToken &&
                    this._previousToken.tokenType === 161 &&
                    FormatVisitor.countNewlines(this.doc.tokenText(this._previousToken)) > 0) ||
                    this._hasNewlineWhitespaceChild(node)) {
                    this._nextFormatRule = FormatVisitor.newlineIndentBefore;
                    this._isMultilineCommaDelimitedListStack.push(true);
                    this._incrementIndent();
                }
                else {
                    this._isMultilineCommaDelimitedListStack.push(false);
                    if (node.phraseType !== 142) {
                        this._nextFormatRule = FormatVisitor.noSpaceBefore;
                    }
                }
                return true;
            case 44:
            case 27:
            case 139:
            case 159:
            case 177:
                if ((this._previousToken &&
                    this._previousToken.tokenType === 161 &&
                    FormatVisitor.countNewlines(this.doc.tokenText(this._previousToken)) > 0) ||
                    this._hasNewlineWhitespaceChild(node)) {
                    this._isMultilineCommaDelimitedListStack.push(true);
                    this._incrementIndent();
                }
                else {
                    this._isMultilineCommaDelimitedListStack.push(false);
                }
                this._nextFormatRule = FormatVisitor.singleSpaceOrNewlineIndentBefore;
                return true;
            case 58:
                this._nextFormatRule = FormatVisitor.noSpaceBefore;
                return true;
            case 156:
                if (parent.phraseType === 58) {
                    this._nextFormatRule = FormatVisitor.noSpaceBefore;
                }
                return true;
            case undefined:
                break;
            default:
                if (parent.phraseType === 58) {
                    this._nextFormatRule = FormatVisitor.noSpaceBefore;
                }
                return true;
        }
        let rule = this._nextFormatRule;
        let previous = this._previousToken;
        let previousNonWsToken = this._previousNonWsToken;
        this._previousToken = node;
        if (this._previousToken.tokenType !== 161) {
            this._previousNonWsToken = this._previousToken;
        }
        if (!this.firstToken) {
            this.firstToken = this._previousToken;
        }
        this.last3Tokens.push(this._previousToken);
        if (this.last3Tokens.length > 3) {
            this.last3Tokens.shift();
        }
        if (this._previousToken.tokenType === 156 || this._previousToken.tokenType === 157) {
            this.OpenTagCount++;
        }
        this._nextFormatRule = null;
        if (!this._active && this._startOffset > -1 && parsedDocument_1.ParsedDocument.isOffsetInToken(this._startOffset, node)) {
            this._active = true;
        }
        if (!previous) {
            return false;
        }
        switch (node.tokenType) {
            case 161:
                this._nextFormatRule = rule;
                return false;
            case 159:
                return false;
            case 160:
                rule = FormatVisitor.newlineIndentBefore;
                break;
            case 135:
                if (parent.phraseType === 132) {
                    rule = FormatVisitor.noSpaceBefore;
                }
                break;
            case 129:
                if (parent.phraseType === 131) {
                    rule = FormatVisitor.noSpaceBefore;
                }
                break;
            case 147:
                if (parent.phraseType === 121) {
                    rule = FormatVisitor.noSpaceBefore;
                }
                break;
            case 84:
                if (previousNonWsToken.tokenType === 90) {
                    rule = FormatVisitor.noSpaceBefore;
                }
                break;
            case 88:
            case 93:
            case 81:
            case 80:
            case 131:
            case 128:
                rule = FormatVisitor.noSpaceBefore;
                break;
            case 116:
                if (previousNonWsToken && previousNonWsToken.tokenType === 90) {
                    rule = FormatVisitor.noSpaceBefore;
                }
                else if (!rule) {
                    rule = FormatVisitor.singleSpaceBefore;
                }
                break;
            case 87:
                if (parent.phraseType === 17 || parent.phraseType === 48) {
                    rule = FormatVisitor.noSpaceBefore;
                }
                break;
            case 156:
            case 157:
                rule = FormatVisitor.noSpaceBefore;
                this._indentText = FormatVisitor.createWhitespace(Math.ceil((this.doc.lineSubstring(node.offset).length - 1) / this._indentUnit.length), this._indentUnit);
                break;
            case 18:
            case 19:
                if (previousNonWsToken && previousNonWsToken.tokenType === 119) {
                    rule = FormatVisitor.singleSpaceBefore;
                }
                break;
            case 83:
                if (parent.phraseType === 136 || previousNonWsToken.tokenType === 147) {
                    rule = FormatVisitor.noSpaceBefore;
                }
                break;
            case 68:
                if (parent.phraseType === 49) {
                    rule = FormatVisitor.singleSpaceBefore;
                }
                break;
            case 8:
                rule = FormatVisitor.singleSpaceBefore;
                break;
            case 115:
            case 133:
                if (previous && previous.tokenType === 161 && FormatVisitor.countNewlines(this.doc.tokenText(previous)) > 0) {
                    let outerExpr = parent;
                    for (let n = spine.length - 2; n >= 0; --n) {
                        if (parsedDocument_1.ParsedDocument.isPhrase(spine[n], FormatVisitor.memberAccessExprTypes)) {
                            outerExpr = spine[n];
                        }
                        else {
                            break;
                        }
                    }
                    if (!this._decrementOnTheseNodes.find((x) => { return x === outerExpr; })) {
                        this._decrementOnTheseNodes.push(outerExpr);
                        this._incrementIndent();
                    }
                }
                rule = FormatVisitor.noSpaceOrNewlineIndentBefore;
                break;
            case 118:
                if (this._shouldOpenParenthesisHaveNoSpaceBefore(parent, previousNonWsToken)) {
                    rule = FormatVisitor.noSpaceBefore;
                }
                else if (!rule) {
                    rule = FormatVisitor.singleSpaceBefore;
                }
                break;
            case 117:
                if (parent.phraseType === 160) {
                    rule = FormatVisitor.noSpaceBefore;
                }
                break;
            case 119:
                this._decrementIndent();
                if (parent.phraseType === 160 ||
                    parent.phraseType === 56 ||
                    parent.phraseType === 57) {
                    rule = FormatVisitor.noSpaceBefore;
                }
                else {
                    rule = FormatVisitor.newlineIndentBefore;
                }
                break;
            case 120:
            case 121:
                if (!rule) {
                    rule = FormatVisitor.noSpaceBefore;
                }
                break;
            case 158:
                if (previous.tokenType === 159 && this.doc.tokenText(previous).slice(0, 2) !== '/*') {
                    rule = FormatVisitor.noSpaceBefore;
                }
                else if (rule !== FormatVisitor.indentOrNewLineIndentBefore) {
                    rule = FormatVisitor.singleSpaceOrNewlineIndentBefore;
                }
                break;
            default:
                break;
        }
        if (!rule) {
            rule = FormatVisitor.singleSpaceOrNewlineIndentPlusOneBefore;
        }
        if (!this._active) {
            return false;
        }
        let edit = rule(previous, this.doc, this._indentText, this._indentUnit);
        if (edit) {
            this._edits.push(edit);
        }
        if (this._isKeyword(node)) {
            let text = this.doc.tokenText(node);
            let lcText = text.toLowerCase();
            if (text !== lcText) {
                this._edits.push(lsp.TextEdit.replace(this.doc.tokenRange(node), lcText));
            }
        }
        else if (this._isTrueFalseNull(node, spine)) {
            let text = this.doc.tokenText(node);
            let lcText = text.toLowerCase();
            if (text !== lcText) {
                this._edits.push(lsp.TextEdit.replace(this.doc.tokenRange(node), lcText));
            }
        }
        return false;
    }
    postorder(node, spine) {
        let parent = spine[spine.length - 1];
        let decrementOnNode = this._decrementOnTheseNodes.length ? this._decrementOnTheseNodes[this._decrementOnTheseNodes.length - 1] : undefined;
        if (decrementOnNode === node) {
            this._decrementIndent();
            this._decrementOnTheseNodes.pop();
        }
        switch (node.phraseType) {
            case 17:
            case 48:
                this._decrementIndent();
                return;
            case 120:
                this._nextFormatRule = FormatVisitor.doubleNewlineIndentBefore;
                return;
            case 124:
                if (this._isLastNamespaceUseDeclaration(parent, node)) {
                    this._nextFormatRule = FormatVisitor.doubleNewlineIndentBefore;
                }
                return;
            case 130:
            case 8:
            case 36:
            case 142:
            case 11:
                if (this._isMultilineCommaDelimitedListStack.pop()) {
                    this._nextFormatRule = FormatVisitor.newlineIndentBefore;
                    this._decrementIndent();
                    if (node.phraseType === 130) {
                        this._lastParameterListWasMultiLine = true;
                    }
                }
                return;
            case 44:
            case 139:
            case 27:
            case 159:
            case 177:
                if (this._isMultilineCommaDelimitedListStack.pop()) {
                    this._decrementIndent();
                }
                return;
            case 58:
                this._nextFormatRule = FormatVisitor.noSpaceBefore;
                return;
            case 4:
                this._nextFormatRule = null;
                break;
            case undefined:
                break;
            default:
                return;
        }
        switch (node.tokenType) {
            case 159:
                if (this.doc.tokenText(node).slice(0, 2) === '/*') {
                    this._nextFormatRule = FormatVisitor.singleSpaceOrNewlineIndentBefore;
                    if (this._active) {
                        let edit = this._formatDocBlock(node);
                        if (edit) {
                            this._edits.push(edit);
                        }
                    }
                }
                else {
                    this._nextFormatRule = FormatVisitor.indentOrNewLineIndentBefore;
                }
                break;
            case 160:
                this._nextFormatRule = FormatVisitor.newlineIndentBefore;
                if (!this._active) {
                    break;
                }
                let edit = this._formatDocBlock(node);
                if (edit) {
                    this._edits.push(edit);
                }
                break;
            case 116:
                if (parent.phraseType === 56) {
                    this._nextFormatRule = FormatVisitor.noSpaceBefore;
                }
                else {
                    this._nextFormatRule = FormatVisitor.newlineIndentBefore;
                }
                this._incrementIndent();
                break;
            case 119:
                if (parent.phraseType !== 57 &&
                    parent.phraseType !== 56 &&
                    parent.phraseType !== 160) {
                    this._nextFormatRule = FormatVisitor.newlineIndentBefore;
                }
                break;
            case 88:
                if (parent.phraseType === 83) {
                    this._nextFormatRule = FormatVisitor.singleSpaceBefore;
                }
                else {
                    this._nextFormatRule = FormatVisitor.newlineIndentBefore;
                }
                break;
            case 87:
                if (this._shouldIndentAfterColon(spine[spine.length - 1])) {
                    this._incrementIndent();
                    this._nextFormatRule = FormatVisitor.newlineIndentBefore;
                }
                break;
            case 103:
                if (parent.phraseType !== 14) {
                    this._nextFormatRule = FormatVisitor.noSpaceBefore;
                }
                break;
            case 111:
            case 143:
                if (parent.phraseType === 174) {
                    this._nextFormatRule = FormatVisitor.noSpaceBefore;
                }
                break;
            case 135:
                if (parent.phraseType === 134) {
                    this._nextFormatRule = FormatVisitor.noSpaceBefore;
                }
                break;
            case 129:
                if (parent.phraseType === 133) {
                    this._nextFormatRule = FormatVisitor.noSpaceBefore;
                }
                break;
            case 134:
            case 89:
            case 94:
            case 155:
            case 148:
            case 153:
            case 152:
            case 151:
            case 150:
            case 149:
            case 86:
            case 147:
            case 118:
            case 117:
                this._nextFormatRule = FormatVisitor.noSpaceBefore;
                break;
            case 128:
            case 131:
                this._incrementIndent();
                this._nextFormatRule = FormatVisitor.noSpaceBefore;
                break;
            case 93:
                if (parent.phraseType === 11 ||
                    parent.phraseType === 44 ||
                    parent.phraseType === 27 ||
                    parent.phraseType === 139 ||
                    parent.phraseType === 159 ||
                    parent.phraseType === 177) {
                    this._nextFormatRule = FormatVisitor.singleSpaceOrNewlineIndentBefore;
                }
                else if (this._isMultilineCommaDelimitedListStack.length > 0 &&
                    this._isMultilineCommaDelimitedListStack[this._isMultilineCommaDelimitedListStack.length - 1]) {
                    this._nextFormatRule = FormatVisitor.newlineIndentBefore;
                }
                break;
            case 115:
            case 133:
                this._nextFormatRule = FormatVisitor.noSpaceBefore;
                break;
            case 156:
                let tagText = this.doc.tokenText(node);
                if (tagText.length > 2) {
                    if (FormatVisitor.countNewlines(tagText) > 0) {
                        this._nextFormatRule = FormatVisitor.indentOrNewLineIndentBefore;
                    }
                    else {
                        this._nextFormatRule = FormatVisitor.noSpaceOrNewlineIndentBefore;
                    }
                    break;
                }
            case 157:
                this._nextFormatRule = FormatVisitor.singleSpaceOrNewlineIndentBefore;
                break;
            default:
                break;
        }
        if (this._active && this._endOffset > -1 && parsedDocument_1.ParsedDocument.isOffsetInToken(this._endOffset, node)) {
            this.haltTraverse = true;
            this._active = false;
        }
    }
    _isTrueFalseNull(node, spine) {
        let parent = spine.length ? spine[spine.length - 1] : undefined;
        let greatGrandParent = spine.length > 2 ? spine[spine.length - 3] : undefined;
        const keywords = ['true', 'false', 'null'];
        return parsedDocument_1.ParsedDocument.isToken(node, [83]) &&
            parsedDocument_1.ParsedDocument.isPhrase(parent, [121]) &&
            parent.children.length === 1 &&
            parsedDocument_1.ParsedDocument.isPhrase(greatGrandParent, [41]) &&
            keywords.indexOf(this.doc.tokenText(node).toLowerCase()) > -1;
    }
    _formatDocBlock(node) {
        let text = this.doc.tokenText(node);
        let formatted = text.replace(FormatVisitor._docBlockRegex, '\n' + this._indentText + ' *');
        return formatted !== text ? lsp.TextEdit.replace(this.doc.tokenRange(node), formatted) : null;
    }
    _incrementIndent() {
        this._indentText += this._indentUnit;
    }
    _decrementIndent() {
        this._indentText = this._indentText.slice(0, -this._indentUnit.length);
    }
    _hasNewlineWhitespaceChild(phrase) {
        for (let n = 0, l = phrase.children.length; n < l; ++n) {
            if (phrase.children[n].tokenType === 161 &&
                FormatVisitor.countNewlines(this.doc.tokenText(phrase.children[n])) > 0) {
                return true;
            }
        }
        return false;
    }
    _isLastNamespaceUseDeclaration(parent, child) {
        let i = parent.children.indexOf(child);
        while (i < parent.children.length) {
            ++i;
            child = parent.children[i];
            if (child.phraseType) {
                return child.phraseType !== 124;
            }
        }
        return true;
    }
    _shouldIndentAfterColon(parent) {
        switch (parent.phraseType) {
            case 17:
            case 48:
                return true;
            default:
                return false;
        }
    }
    _shouldOpenParenthesisHaveNoSpaceBefore(parent, lastNonWsToken) {
        switch (parent.phraseType) {
            case 85:
            case 112:
            case 150:
            case 51:
            case 55:
            case 69:
            case 70:
            case 107:
            case 108:
            case 135:
            case 175:
            case 9:
            case 88:
            case 115:
            case 128:
            case 146:
            case 147:
            case 97:
            case 98:
                return true;
            default:
                if (!lastNonWsToken) {
                    return false;
                }
                break;
        }
        switch (lastNonWsToken.tokenType) {
            case 57:
            case 58:
            case 41:
            case 42:
            case 46:
            case 47:
            case 53:
            case 65:
            case 28:
            case 29:
            case 20:
                return true;
            default:
                return false;
        }
    }
    _hasColonChild(phrase) {
        for (let n = 0, l = phrase.children.length; n < l; ++n) {
            if (phrase.children[n].tokenType === 87) {
                return true;
            }
        }
        return false;
    }
    _isKeyword(t) {
        if (!t) {
            return false;
        }
        switch (t.tokenType) {
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
            case 8:
            case 9:
            case 10:
            case 11:
            case 12:
            case 13:
            case 14:
            case 15:
            case 16:
            case 17:
            case 18:
            case 19:
            case 20:
            case 21:
            case 22:
            case 23:
            case 24:
            case 25:
            case 26:
            case 28:
            case 29:
            case 30:
            case 31:
            case 32:
            case 33:
            case 34:
            case 35:
            case 36:
            case 37:
            case 38:
            case 39:
            case 40:
            case 41:
            case 42:
            case 43:
            case 44:
            case 45:
            case 46:
            case 47:
            case 48:
            case 49:
            case 50:
            case 51:
            case 52:
            case 53:
            case 54:
            case 55:
            case 56:
            case 57:
            case 58:
            case 59:
            case 60:
            case 61:
            case 62:
            case 63:
            case 64:
            case 65:
            case 66:
            case 67:
            case 68:
            case 69:
            case 70:
                return true;
            default:
                return false;
        }
    }
}
FormatVisitor._docBlockRegex = /(?:\r\n|\r|\n)[ \t]*\*/g;
FormatVisitor.memberAccessExprTypes = [
    112, 136,
    150, 24, 152
];
(function (FormatVisitor) {
    function singleSpaceBefore(previous, doc, indentText, indentUnit) {
        if (previous.tokenType !== 161) {
            return lsp.TextEdit.insert(doc.positionAtOffset(previous.offset + previous.length), ' ');
        }
        let actualWs = doc.tokenText(previous);
        let expectedWs = ' ';
        if (actualWs === expectedWs) {
            return null;
        }
        return lsp.TextEdit.replace(doc.tokenRange(previous), expectedWs);
    }
    FormatVisitor.singleSpaceBefore = singleSpaceBefore;
    function indentBefore(previous, doc, indentText, indentUnit) {
        if (previous.tokenType !== 161) {
            return indentText ? lsp.TextEdit.insert(doc.positionAtOffset(previous.offset + previous.length), indentText) : null;
        }
        if (!indentText) {
            return lsp.TextEdit.del(doc.tokenRange(previous));
        }
        let actualWs = doc.tokenText(previous);
        if (actualWs === indentText) {
            return null;
        }
        return lsp.TextEdit.replace(doc.tokenRange(previous), indentText);
    }
    FormatVisitor.indentBefore = indentBefore;
    function indentOrNewLineIndentBefore(previous, doc, indentText, indentUnit) {
        if (previous.tokenType !== 161) {
            return indentText ? lsp.TextEdit.insert(doc.positionAtOffset(previous.offset + previous.length), indentText) : null;
        }
        let actualWs = doc.tokenText(previous);
        let nl = countNewlines(actualWs);
        if (nl) {
            let expectedWs = createWhitespace(Math.max(1, nl), '\n') + indentText;
            if (actualWs === expectedWs) {
                return null;
            }
            return lsp.TextEdit.replace(doc.tokenRange(previous), expectedWs);
        }
        if (!indentText) {
            return lsp.TextEdit.del(doc.tokenRange(previous));
        }
        if (actualWs === indentText) {
            return null;
        }
        return lsp.TextEdit.replace(doc.tokenRange(previous), indentText);
    }
    FormatVisitor.indentOrNewLineIndentBefore = indentOrNewLineIndentBefore;
    function newlineIndentBefore(previous, doc, indentText, indentUnit) {
        if (previous.tokenType !== 161) {
            return lsp.TextEdit.insert(doc.positionAtOffset(previous.offset + previous.length), '\n' + indentText);
        }
        let actualWs = doc.tokenText(previous);
        let expectedWs = createWhitespace(Math.max(1, countNewlines(actualWs)), '\n') + indentText;
        if (actualWs === expectedWs) {
            return null;
        }
        return lsp.TextEdit.replace(doc.tokenRange(previous), expectedWs);
    }
    FormatVisitor.newlineIndentBefore = newlineIndentBefore;
    function doubleNewlineIndentBefore(previous, doc, indentText, indentUnit) {
        if (previous.tokenType !== 161) {
            return lsp.TextEdit.insert(doc.positionAtOffset(previous.offset + previous.length), '\n\n' + indentText);
        }
        let actualWs = doc.tokenText(previous);
        let expected = createWhitespace(Math.max(2, countNewlines(actualWs)), '\n') + indentText;
        if (actualWs === expected) {
            return null;
        }
        return lsp.TextEdit.replace(doc.tokenRange(previous), expected);
    }
    FormatVisitor.doubleNewlineIndentBefore = doubleNewlineIndentBefore;
    function noSpaceBefore(previous, doc, indentText, indentUnit) {
        if (previous.tokenType !== 161) {
            return null;
        }
        return lsp.TextEdit.del(doc.tokenRange(previous));
    }
    FormatVisitor.noSpaceBefore = noSpaceBefore;
    function noSpaceOrNewlineIndentPlusOneBefore(previous, doc, indentText, indentUnit) {
        if (previous.tokenType !== 161) {
            return null;
        }
        let actualWs = doc.tokenText(previous);
        let newlineCount = countNewlines(actualWs);
        if (!newlineCount) {
            return lsp.TextEdit.del(doc.tokenRange(previous));
        }
        let expectedWs = createWhitespace(newlineCount, '\n') + indentText + indentUnit;
        if (actualWs === expectedWs) {
            return null;
        }
        return lsp.TextEdit.replace(doc.tokenRange(previous), expectedWs);
    }
    FormatVisitor.noSpaceOrNewlineIndentPlusOneBefore = noSpaceOrNewlineIndentPlusOneBefore;
    function noSpaceOrNewlineIndentBefore(previous, doc, indentText, indentUnit) {
        if (previous.tokenType !== 161) {
            return null;
        }
        let actualWs = doc.tokenText(previous);
        let newlineCount = countNewlines(actualWs);
        if (!newlineCount) {
            return lsp.TextEdit.del(doc.tokenRange(previous));
        }
        let expectedWs = createWhitespace(newlineCount, '\n') + indentText;
        if (actualWs === expectedWs) {
            return null;
        }
        return lsp.TextEdit.replace(doc.tokenRange(previous), expectedWs);
    }
    FormatVisitor.noSpaceOrNewlineIndentBefore = noSpaceOrNewlineIndentBefore;
    function singleSpaceOrNewlineIndentPlusOneBefore(previous, doc, indentText, indentUnit) {
        if (previous.tokenType !== 161) {
            return lsp.TextEdit.insert(doc.positionAtOffset(previous.offset + previous.length), ' ');
        }
        let actualWs = doc.tokenText(previous);
        if (actualWs === ' ') {
            return null;
        }
        let newlineCount = countNewlines(actualWs);
        if (!newlineCount) {
            return lsp.TextEdit.replace(doc.tokenRange(previous), ' ');
        }
        let expectedWs = createWhitespace(newlineCount, '\n') + indentText + indentUnit;
        if (actualWs !== expectedWs) {
            return lsp.TextEdit.replace(doc.tokenRange(previous), expectedWs);
        }
        return null;
    }
    FormatVisitor.singleSpaceOrNewlineIndentPlusOneBefore = singleSpaceOrNewlineIndentPlusOneBefore;
    function singleSpaceOrNewlineIndentBefore(previous, doc, indentText, indentUnit) {
        if (previous.tokenType !== 161) {
            return lsp.TextEdit.insert(doc.positionAtOffset(previous.offset + previous.length), ' ');
        }
        let actualWs = doc.tokenText(previous);
        if (actualWs === ' ') {
            return null;
        }
        let newlineCount = countNewlines(actualWs);
        if (!newlineCount) {
            return lsp.TextEdit.replace(doc.tokenRange(previous), ' ');
        }
        let expectedWs = createWhitespace(newlineCount, '\n') + indentText;
        if (actualWs !== expectedWs) {
            return lsp.TextEdit.replace(doc.tokenRange(previous), expectedWs);
        }
        return null;
    }
    FormatVisitor.singleSpaceOrNewlineIndentBefore = singleSpaceOrNewlineIndentBefore;
    function createWhitespace(n, unit) {
        let text = '';
        while (n > 0) {
            text += unit;
            --n;
        }
        return text;
    }
    FormatVisitor.createWhitespace = createWhitespace;
    function countNewlines(text) {
        let c;
        let count = 0;
        let l = text.length;
        let n = 0;
        while (n < l) {
            c = text[n];
            ++n;
            if (c === '\r') {
                ++count;
                if (n < l && text[n] === '\n') {
                    ++n;
                }
            }
            else if (c === '\n') {
                ++count;
            }
        }
        return count;
    }
    FormatVisitor.countNewlines = countNewlines;
})(FormatVisitor || (FormatVisitor = {}));
