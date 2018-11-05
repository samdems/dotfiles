/* Copyright (c) Ben Robert Mewburn 
 * Licensed under the ISC Licence.
 */

'use strict';

import { Token, Lexer, TokenType, LexerMode } from './lexer';
import {
    ParseError,
    Phrase,
    PhraseType,
} from './phrase';

export namespace Parser {

    interface Predicate {
        (t: Token): boolean;
    }

    const enum Associativity {
        None,
        Left,
        Right
    }

    function precedenceAssociativityTuple(t: Token) {
        switch (t.tokenType) {
            case TokenType.AsteriskAsterisk:
                return [48, Associativity.Right];
            case TokenType.PlusPlus:
                return [47, Associativity.Right];
            case TokenType.MinusMinus:
                return [47, Associativity.Right];
            case TokenType.Tilde:
                return [47, Associativity.Right];
            case TokenType.IntegerCast:
                return [47, Associativity.Right];
            case TokenType.FloatCast:
                return [47, Associativity.Right];
            case TokenType.StringCast:
                return [47, Associativity.Right];
            case TokenType.ArrayCast:
                return [47, Associativity.Right];
            case TokenType.ObjectCast:
                return [47, Associativity.Right];
            case TokenType.BooleanCast:
                return [47, Associativity.Right];
            case TokenType.UnsetCast:
                return [47, Associativity.Right];
            case TokenType.AtSymbol:
                return [47, Associativity.Right];
            case TokenType.InstanceOf:
                return [46, Associativity.None];
            case TokenType.Exclamation:
                return [45, Associativity.Right];
            case TokenType.Asterisk:
                return [44, Associativity.Left];
            case TokenType.ForwardSlash:
                return [44, Associativity.Left];
            case TokenType.Percent:
                return [44, Associativity.Left];
            case TokenType.Plus:
                return [43, Associativity.Left];
            case TokenType.Minus:
                return [43, Associativity.Left];
            case TokenType.Dot:
                return [43, Associativity.Left];
            case TokenType.LessThanLessThan:
                return [42, Associativity.Left];
            case TokenType.GreaterThanGreaterThan:
                return [42, Associativity.Left];
            case TokenType.LessThan:
                return [41, Associativity.None];
            case TokenType.GreaterThan:
                return [41, Associativity.None];
            case TokenType.LessThanEquals:
                return [41, Associativity.None];
            case TokenType.GreaterThanEquals:
                return [41, Associativity.None];
            case TokenType.EqualsEquals:
                return [40, Associativity.None];
            case TokenType.EqualsEqualsEquals:
                return [40, Associativity.None];
            case TokenType.ExclamationEquals:
                return [40, Associativity.None];
            case TokenType.ExclamationEqualsEquals:
                return [40, Associativity.None];
            case TokenType.Spaceship:
                return [40, Associativity.None];
            case TokenType.Ampersand:
                return [39, Associativity.Left];
            case TokenType.Caret:
                return [38, Associativity.Left];
            case TokenType.Bar:
                return [37, Associativity.Left];
            case TokenType.AmpersandAmpersand:
                return [36, Associativity.Left];
            case TokenType.BarBar:
                return [35, Associativity.Left];
            case TokenType.QuestionQuestion:
                return [34, Associativity.Right];
            case TokenType.Question:
                return [33, Associativity.Left]; //?: ternary
            case TokenType.Equals:
                return [32, Associativity.Right];
            case TokenType.DotEquals:
                return [32, Associativity.Right];
            case TokenType.PlusEquals:
                return [32, Associativity.Right];
            case TokenType.MinusEquals:
                return [32, Associativity.Right];
            case TokenType.AsteriskEquals:
                return [32, Associativity.Right];
            case TokenType.ForwardslashEquals:
                return [32, Associativity.Right];
            case TokenType.PercentEquals:
                return [32, Associativity.Right];
            case TokenType.AsteriskAsteriskEquals:
                return [32, Associativity.Right];
            case TokenType.AmpersandEquals:
                return [32, Associativity.Right];
            case TokenType.BarEquals:
                return [32, Associativity.Right];
            case TokenType.CaretEquals:
                return [32, Associativity.Right];
            case TokenType.LessThanLessThanEquals:
                return [32, Associativity.Right];
            case TokenType.GreaterThanGreaterThanEquals:
                return [32, Associativity.Right];
            case TokenType.And:
                return [31, Associativity.Left];
            case TokenType.Xor:
                return [30, Associativity.Left];
            case TokenType.Or:
                return [29, Associativity.Left];
            default:
                throwUnexpectedTokenError(t);

        }
    }

    const statementListRecoverSet = [
        TokenType.Use,
        TokenType.HaltCompiler,
        TokenType.Const,
        TokenType.Function,
        TokenType.Class,
        TokenType.Abstract,
        TokenType.Final,
        TokenType.Trait,
        TokenType.Interface,
        TokenType.OpenBrace,
        TokenType.If,
        TokenType.While,
        TokenType.Do,
        TokenType.For,
        TokenType.Switch,
        TokenType.Break,
        TokenType.Continue,
        TokenType.Return,
        TokenType.Global,
        TokenType.Static,
        TokenType.Echo,
        TokenType.Unset,
        TokenType.ForEach,
        TokenType.Declare,
        TokenType.Try,
        TokenType.Throw,
        TokenType.Goto,
        TokenType.Semicolon,
        TokenType.CloseTag,
        TokenType.OpenTagEcho,
        TokenType.Text,
        TokenType.OpenTag
    ];

    const classMemberDeclarationListRecoverSet = [
        TokenType.Public,
        TokenType.Protected,
        TokenType.Private,
        TokenType.Static,
        TokenType.Abstract,
        TokenType.Final,
        TokenType.Function,
        TokenType.Var,
        TokenType.Const,
        TokenType.Use
    ];

    const encapsulatedVariableListRecoverSet = [
        TokenType.EncapsulatedAndWhitespace,
        TokenType.DollarCurlyOpen,
        TokenType.CurlyOpen
    ];

    function binaryOpToPhraseType(t: Token) {
        switch (t.tokenType) {
            case TokenType.Question:
                return PhraseType.TernaryExpression;
            case TokenType.Dot:
            case TokenType.Plus:
            case TokenType.Minus:
                return PhraseType.AdditiveExpression;
            case TokenType.Bar:
            case TokenType.Ampersand:
            case TokenType.Caret:
                return PhraseType.BitwiseExpression;
            case TokenType.Asterisk:
            case TokenType.ForwardSlash:
            case TokenType.Percent:
                return PhraseType.MultiplicativeExpression;
            case TokenType.AsteriskAsterisk:
                return PhraseType.ExponentiationExpression;
            case TokenType.LessThanLessThan:
            case TokenType.GreaterThanGreaterThan:
                return PhraseType.ShiftExpression;
            case TokenType.AmpersandAmpersand:
            case TokenType.BarBar:
            case TokenType.And:
            case TokenType.Or:
            case TokenType.Xor:
                return PhraseType.LogicalExpression;
            case TokenType.EqualsEqualsEquals:
            case TokenType.ExclamationEqualsEquals:
            case TokenType.EqualsEquals:
            case TokenType.ExclamationEquals:
                return PhraseType.EqualityExpression;
            case TokenType.LessThan:
            case TokenType.LessThanEquals:
            case TokenType.GreaterThan:
            case TokenType.GreaterThanEquals:
            case TokenType.Spaceship:
                return PhraseType.RelationalExpression;
            case TokenType.QuestionQuestion:
                return PhraseType.CoalesceExpression;
            case TokenType.Equals:
                return PhraseType.SimpleAssignmentExpression;
            case TokenType.PlusEquals:
            case TokenType.MinusEquals:
            case TokenType.AsteriskEquals:
            case TokenType.AsteriskAsteriskEquals:
            case TokenType.ForwardslashEquals:
            case TokenType.DotEquals:
            case TokenType.PercentEquals:
            case TokenType.AmpersandEquals:
            case TokenType.BarEquals:
            case TokenType.CaretEquals:
            case TokenType.LessThanLessThanEquals:
            case TokenType.GreaterThanGreaterThanEquals:
                return PhraseType.CompoundAssignmentExpression;
            case TokenType.InstanceOf:
                return PhraseType.InstanceOfExpression;
            default:
                return PhraseType.Unknown;

        }
    }

    var tokenBuffer: Token[];
    var phraseStack: Phrase[];
    var errorPhrase: ParseError;
    var recoverSetStack: TokenType[][];

    export function parse(text: string): Phrase {

        init(text);
        let stmtList = statementList([TokenType.EndOfFile]);
        //append trailing hidden tokens
        hidden(stmtList);
        return stmtList;
    }

    function init(text: string, lexerModeStack?: LexerMode[]) {
        Lexer.setInput(text, lexerModeStack);
        phraseStack = [];
        tokenBuffer = [];
        recoverSetStack = [];
        errorPhrase = null;
    }

    function start(phraseType?:PhraseType, dontPushHiddenToParent?: boolean) {
        //parent node gets hidden tokens between children
        if (!dontPushHiddenToParent) {
            hidden();
        }
        let p:Phrase = {
            phraseType: phraseType ? phraseType : PhraseType.Unknown,
            children: []
        }
        phraseStack.push(p);
        return p;
    }

    function end() {
        return phraseStack.pop();
    }

    function hidden(p?:Phrase) {

        if(!p) {
            p = phraseStack[phraseStack.length - 1];
        }
        
        let t: Token;

        while (true) {
            
            t = tokenBuffer.length ? tokenBuffer.shift() : Lexer.lex();
            if (t.tokenType < TokenType.Comment) {
                tokenBuffer.unshift(t);
                break;
            } else {
                p.children.push(t);
            }

        }

    }

    function optional(tokenType: TokenType) {

        if (tokenType === peek().tokenType) {
            errorPhrase = null;
            return next();
        } else {
            return null;
        }

    }

    function optionalOneOf(tokenTypes: TokenType[]) {

        if (tokenTypes.indexOf(peek().tokenType) >= 0) {
            errorPhrase = null;
            return next();
        } else {
            return null;
        }

    }

    function next(doNotPush?: boolean): Token {

        let t = tokenBuffer.length ? tokenBuffer.shift() : Lexer.lex();

        if (t.tokenType === TokenType.EndOfFile) {
            return t;
        }

        if (t.tokenType >= TokenType.Comment) {
            //hidden token
            phraseStack[phraseStack.length - 1].children.push(t);
            return next(doNotPush);
        } else if (!doNotPush) {
            phraseStack[phraseStack.length - 1].children.push(t);
        }

        return t;

    }

    function expect(tokenType: TokenType) {

        let t = peek();

        if (t.tokenType === tokenType) {
            errorPhrase = null;
            return next();
        } else if (tokenType === TokenType.Semicolon && t.tokenType === TokenType.CloseTag) {
            //implicit end statement
            return t;
        } else {
            error(tokenType);
            //test skipping a single token to sync
            if (peek(1).tokenType === tokenType) {
                let predicate = (x: Token) => { return x.tokenType === tokenType; };
                skip(predicate);
                errorPhrase = null;
                return next(); //tokenType
            }
            return null;
        }

    }

    function expectOneOf(tokenTypes: TokenType[]) {

        let t = peek();

        if (tokenTypes.indexOf(t.tokenType) >= 0) {
            errorPhrase = null;
            return next();
        } else if (tokenTypes.indexOf(TokenType.Semicolon) >= 0 && t.tokenType === TokenType.CloseTag) {
            //implicit end statement
            return t;
        } else {
            error();
            //test skipping single token to sync
            if (tokenTypes.indexOf(peek(1).tokenType) >= 0) {
                let predicate = (x: Token) => { return tokenTypes.indexOf(x.tokenType) >= 0; };
                skip(predicate);
                errorPhrase = null;
                return next(); //tokenType
            }
            return null;
        }

    }

    function peek(n?: number) {

        let k = n ? n + 1 : 1;
        let bufferPos = -1;
        let t: Token;

        while (true) {
            
            ++bufferPos;
            if (bufferPos === tokenBuffer.length) {
                tokenBuffer.push(Lexer.lex());
            }

            t = tokenBuffer[bufferPos];

            if (t.tokenType < TokenType.Comment) {
                //not a hidden token
                --k;
            }

            if (t.tokenType === TokenType.EndOfFile || k === 0) {
                break;
            }

        }

        return t;
    }

    /**
     * skipped tokens get pushed to error phrase children
     */
    function skip(predicate: Predicate) {

        let t: Token;

        while (true) {
            t = tokenBuffer.length ? tokenBuffer.shift() : Lexer.lex();

            if (predicate(t) || t.tokenType === TokenType.EndOfFile) {
                tokenBuffer.unshift(t);
                break;
            } else {
                errorPhrase.children.push(t);
            }
        }

    }

    function error(expected?:TokenType) {

        //dont report errors if recovering from another
        if (errorPhrase) {
            return;
        }

        errorPhrase = <ParseError>{
            phraseType : PhraseType.Error,
            children:[],
            unexpected: peek()
        };

        if(expected) {
            errorPhrase.expected = expected;
        }

        phraseStack[phraseStack.length - 1].children.push(errorPhrase);

    }

    function list(phraseType: PhraseType, elementFunction: () => Phrase | Token,
        elementStartPredicate: Predicate, breakOn?: TokenType[], recoverSet?: TokenType[]) {

        let p = start(phraseType);

        let t: Token;
        let recoveryAttempted = false;
        let listRecoverSet = recoverSet ? recoverSet.slice(0) : [];

        if (breakOn) {
            Array.prototype.push.apply(listRecoverSet, breakOn);
        }

        recoverSetStack.push(listRecoverSet);

        while (true) {
            
            t = peek();
            
            if (elementStartPredicate(t)) {
                recoveryAttempted = false;
                p.children.push(elementFunction());
            } else if (!breakOn || breakOn.indexOf(t.tokenType) >= 0 || recoveryAttempted) {
                break;
            } else {
                error();
                //attempt to sync with token stream
                t = peek(1);
                if (elementStartPredicate(t) || breakOn.indexOf(t.tokenType) >= 0) {
                    skip((x) => { return x === t });
                } else {
                    defaultSyncStrategy();
                }
                recoveryAttempted = true;
            }

        }

        recoverSetStack.pop();

        return end();

    }

    function defaultSyncStrategy() {

        let mergedRecoverTokenTypeArray: TokenType[] = [];

        for (let n = recoverSetStack.length - 1; n >= 0; --n) {
            Array.prototype.push.apply(mergedRecoverTokenTypeArray, recoverSetStack[n]);
        }

        let mergedRecoverTokenTypeSet = new Set(mergedRecoverTokenTypeArray);
        let predicate: Predicate = (x) => { return mergedRecoverTokenTypeSet.has(x.tokenType); };
        skip(predicate);

    }
/*
    function isListPhrase(phraseType: PhraseType) {
        switch (phraseType) {
            case PhraseType.StatementList:
                return true;
            default:
                false;
        }
    }
*/
    function statementList(breakOn: TokenType[]) {

        return list(
            PhraseType.StatementList,
            statement,
            isStatementStart,
            breakOn,
            statementListRecoverSet);

    }

    function constDeclaration() {

        let p = start(PhraseType.ConstDeclaration);
        next(); //const
        p.children.push(delimitedList(
            PhraseType.ConstElementList,
            constElement,
            isConstElementStartToken,
            TokenType.Comma,
            [TokenType.Semicolon]
        ));
        expect(TokenType.Semicolon);
        return end();

    }

    function isClassConstElementStartToken(t: Token) {
        return t.tokenType === TokenType.Name || isSemiReservedToken(t);
    }

    function isConstElementStartToken(t: Token) {
        return t.tokenType === TokenType.Name;
    }

    function constElement() {

        let p = start(PhraseType.ConstElement);
        expect(TokenType.Name);
        expect(TokenType.Equals);
        p.children.push(expression(0));
        return end();

    }

    function expression(minPrecedence: number) {

        let precedence: number;
        let associativity: Associativity;
        let op: Token;
        let lhs = expressionAtom();
        let p: Phrase;
        let rhs: Phrase | Token;
        let binaryPhraseType: PhraseType;

        while (true) {
            
            op = peek();
            binaryPhraseType = binaryOpToPhraseType(op);

            if (binaryPhraseType === PhraseType.Unknown) {
                break;
            }

            [precedence, associativity] = precedenceAssociativityTuple(op);

            if (precedence < minPrecedence) {
                break;
            }

            if (associativity === Associativity.Left) {
                ++precedence;
            }


            if (binaryPhraseType === PhraseType.TernaryExpression) {
                lhs = ternaryExpression(lhs);
                continue;
            }

            p = start(binaryPhraseType, true);
            p.children.push(lhs);
            next();

            if (binaryPhraseType === PhraseType.InstanceOfExpression) {
                p.children.push(typeDesignator(PhraseType.InstanceofTypeDesignator));
            } else {
                if (binaryPhraseType === PhraseType.SimpleAssignmentExpression &&
                    peek().tokenType === TokenType.Ampersand) {
                    next(); //&
                    p.phraseType = PhraseType.ByRefAssignmentExpression;
                }
                p.children.push(expression(precedence));
            }

            lhs = end();

        }

        return lhs;

    }

    function ternaryExpression(testExpr: Phrase | Token) {

        let p = start(PhraseType.TernaryExpression,true);
        p.children.push(testExpr);
        next(); //?

        if (optional(TokenType.Colon)) {
            p.children.push(expression(0));
        } else {
            p.children.push(expression(0));
            expect(TokenType.Colon);
            p.children.push(expression(0));
        }

        return end();
    }


    function variableOrExpression() {

        let part = variableAtom();
        let isVariable = (<Phrase>part).phraseType === PhraseType.SimpleVariable;

        if (isDereferenceOperator(peek())) {
            part = variable(part);
            isVariable = true;
        } else {

            switch ((<Phrase>part).phraseType) {
                case PhraseType.QualifiedName:
                case PhraseType.FullyQualifiedName:
                case PhraseType.RelativeQualifiedName:
                    part = constantAccessExpression(part);
                    break;
                default:
                    break;
            }

        }

        if (!isVariable) {
            return part;
        }

        //check for post increment/decrement
        let t = peek();
        if (t.tokenType === TokenType.PlusPlus) {
            return postfixExpression(PhraseType.PostfixIncrementExpression, <Phrase>part);
        } else if (t.tokenType === TokenType.MinusMinus) {
            return postfixExpression(PhraseType.PostfixDecrementExpression, <Phrase>part);
        } else {
            return part;
        }

    }

    function constantAccessExpression(qName: Phrase | Token) {
        let p = start(PhraseType.ConstantAccessExpression, true);
        p.children.push(qName);
        return end();
    }

    function postfixExpression(phraseType: PhraseType, variableNode: Phrase) {
        let p = start(phraseType,true);
        p.children.push(variableNode);
        next(); //operator
        return end();
    }

    function isDereferenceOperator(t: Token) {
        switch (t.tokenType) {
            case TokenType.OpenBracket:
            case TokenType.OpenBrace:
            case TokenType.Arrow:
            case TokenType.OpenParenthesis:
            case TokenType.ColonColon:
                return true;
            default:
                return false;
        }
    }

    function expressionAtom() {

        let t = peek();

        switch (t.tokenType) {
            case TokenType.Static:
                if (peek(1).tokenType === TokenType.Function) {
                    return anonymousFunctionCreationExpression();
                } else {
                    return variableOrExpression();
                }
            case TokenType.StringLiteral:
                if (isDereferenceOperator(peek(1))) {
                    return variableOrExpression();
                } else {
                    return next(true);
                }
            case TokenType.VariableName:
            case TokenType.Dollar:
            case TokenType.Array:
            case TokenType.OpenBracket:
            case TokenType.Backslash:
            case TokenType.Name:
            case TokenType.Namespace:
            case TokenType.OpenParenthesis:
                return variableOrExpression();
            case TokenType.PlusPlus:
                return unaryExpression(PhraseType.PrefixIncrementExpression);
            case TokenType.MinusMinus:
                return unaryExpression(PhraseType.PrefixDecrementExpression);
            case TokenType.Plus:
            case TokenType.Minus:
            case TokenType.Exclamation:
            case TokenType.Tilde:
                return unaryExpression(PhraseType.UnaryOpExpression);
            case TokenType.AtSymbol:
                return unaryExpression(PhraseType.ErrorControlExpression);
            case TokenType.IntegerCast:
            case TokenType.FloatCast:
            case TokenType.StringCast:
            case TokenType.ArrayCast:
            case TokenType.ObjectCast:
            case TokenType.BooleanCast:
            case TokenType.UnsetCast:
                return unaryExpression(PhraseType.CastExpression);
            case TokenType.List:
                return listIntrinsic();
            case TokenType.Clone:
                return cloneExpression();
            case TokenType.New:
                return objectCreationExpression();
            case TokenType.FloatingLiteral:
            case TokenType.IntegerLiteral:
            case TokenType.LineConstant:
            case TokenType.FileConstant:
            case TokenType.DirectoryConstant:
            case TokenType.TraitConstant:
            case TokenType.MethodConstant:
            case TokenType.FunctionConstant:
            case TokenType.NamespaceConstant:
            case TokenType.ClassConstant:
                return next(true);
            case TokenType.StartHeredoc:
                return heredocStringLiteral();
            case TokenType.DoubleQuote:
                return doubleQuotedStringLiteral();
            case TokenType.Backtick:
                return shellCommandExpression();
            case TokenType.Print:
                return printIntrinsic();
            case TokenType.Yield:
                return yieldExpression();
            case TokenType.YieldFrom:
                return yieldFromExpression();
            case TokenType.Function:
                return anonymousFunctionCreationExpression();
            case TokenType.Include:
                return scriptInclusion(PhraseType.IncludeExpression);
            case TokenType.IncludeOnce:
                return scriptInclusion(PhraseType.IncludeOnceExpression);
            case TokenType.Require:
                return scriptInclusion(PhraseType.RequireExpression);
            case TokenType.RequireOnce:
                return scriptInclusion(PhraseType.RequireOnceExpression);
            case TokenType.Eval:
                return evalIntrinsic();
            case TokenType.Empty:
                return emptyIntrinsic();
            case TokenType.Exit:
                return exitIntrinsic();
            case TokenType.Isset:
                return issetIntrinsic();
            default:
                //error
                start(PhraseType.ErrorExpression);
                error();
                return end();
        }

    }

    function exitIntrinsic() {
        let p = start(PhraseType.ExitIntrinsic);
        next(); //exit or die
        if (optional(TokenType.OpenParenthesis)) {
            if (isExpressionStart(peek())) {
                p.children.push(expression(0));
            }
            expect(TokenType.CloseParenthesis);
        }
        return end();
    }

    function issetIntrinsic() {

        let p = start(PhraseType.IssetIntrinsic);
        next(); //isset
        expect(TokenType.OpenParenthesis);
        p.children.push(variableList([TokenType.CloseParenthesis]));
        expect(TokenType.CloseParenthesis);
        return end();

    }

    function emptyIntrinsic() {

        let p = start(PhraseType.EmptyIntrinsic);
        next(); //keyword
        expect(TokenType.OpenParenthesis);
        p.children.push(expression(0));
        expect(TokenType.CloseParenthesis);
        return end();

    }

    function evalIntrinsic() {

        let p = start(PhraseType.EvalIntrinsic);
        next(); //keyword
        expect(TokenType.OpenParenthesis);
        p.children.push(expression(0));
        expect(TokenType.CloseParenthesis);
        return end();

    }

    function scriptInclusion(phraseType: PhraseType) {

        let p = start(phraseType);
        next(); //keyword
        p.children.push(expression(0));
        return end();
    }

    function printIntrinsic() {

        let p = start(PhraseType.PrintIntrinsic);
        next(); //keyword
        p.children.push(expression(0));
        return end();
    }

    function yieldFromExpression() {

        let p = start(PhraseType.YieldFromExpression);
        next(); //keyword
        p.children.push(expression(0));
        return end();
    }

    function yieldExpression() {

        let p = start(PhraseType.YieldExpression);
        next(); //yield

        if (!isExpressionStart(peek())) {
            return end();
        }

        let keyOrValue = expression(0);
        p.children.push(keyOrValue);

        if (optional(TokenType.FatArrow)) {
            p.children.push(expression(0));
        }

        return end();

    }

    function shellCommandExpression() {

        let p = start(PhraseType.ShellCommandExpression);
        next(); //`
        p.children.push(encapsulatedVariableList(TokenType.Backtick));
        expect(TokenType.Backtick);
        return end();

    }

    function doubleQuotedStringLiteral() {

        let p = start(PhraseType.DoubleQuotedStringLiteral);
        next(); //"
        p.children.push(encapsulatedVariableList(TokenType.DoubleQuote));
        expect(TokenType.DoubleQuote);
        return end();

    }

    function encapsulatedVariableList(breakOn: TokenType) {

        return list(
            PhraseType.EncapsulatedVariableList,
            encapsulatedVariable,
            isEncapsulatedVariableStart,
            [breakOn],
            encapsulatedVariableListRecoverSet
        );

    }

    function isEncapsulatedVariableStart(t: Token) {

        switch (t.tokenType) {
            case TokenType.EncapsulatedAndWhitespace:
            case TokenType.VariableName:
            case TokenType.DollarCurlyOpen:
            case TokenType.CurlyOpen:
                return true;
            default:
                return false;
        }

    }

    function encapsulatedVariable() {

        switch (peek().tokenType) {
            case TokenType.EncapsulatedAndWhitespace:
                return next(true);
            case TokenType.VariableName:
                let t = peek(1);
                if (t.tokenType === TokenType.OpenBracket) {
                    return encapsulatedDimension();
                } else if (t.tokenType === TokenType.Arrow) {
                    return encapsulatedProperty();
                } else {
                    return simpleVariable();
                }
            case TokenType.DollarCurlyOpen:
                return dollarCurlyOpenEncapsulatedVariable();
            case TokenType.CurlyOpen:
                return curlyOpenEncapsulatedVariable();
            default:
                throwUnexpectedTokenError(peek());
        }

    }

    function curlyOpenEncapsulatedVariable() {

        let p = start(PhraseType.EncapsulatedVariable);
        next(); //{
        p.children.push(variable(variableAtom()));
        expect(TokenType.CloseBrace);
        return end();

    }

    function dollarCurlyOpenEncapsulatedVariable() {

        let p = start(PhraseType.EncapsulatedVariable);
        next(); //${
        let t = peek();

        if (t.tokenType === TokenType.VariableName) {

            if (peek(1).tokenType === TokenType.OpenBracket) {
                p.children.push(dollarCurlyEncapsulatedDimension());
            } else {
                let sv = start(PhraseType.SimpleVariable);
                next();
                p.children.push(end());
            }

        } else if (isExpressionStart(t)) {
            p.children.push(expression(0));
        } else {
            error();
        }

        expect(TokenType.CloseBrace);
        return end();
    }

    function dollarCurlyEncapsulatedDimension() {
        let p = start(PhraseType.SubscriptExpression);
        next(); //VariableName
        next(); // [
        p.children.push(expression(0));
        expect(TokenType.CloseBracket);
        return end();
    }

    function encapsulatedDimension() {

        let p = start(PhraseType.SubscriptExpression);

        p.children.push(simpleVariable()); //T_VARIABLE
        next(); //[

        switch (peek().tokenType) {
            case TokenType.Name:
            case TokenType.IntegerLiteral:
                next();
                break;
            case TokenType.VariableName:
                p.children.push(simpleVariable());
                break;
            case TokenType.Minus:
                let u = start(PhraseType.UnaryOpExpression);
                next(); //-
                expect(TokenType.IntegerLiteral);
                p.children.push(end());
                break;
            default:
                //error
                error();
                break;
        }

        expect(TokenType.CloseBracket);
        return end();

    }

    function encapsulatedProperty() {
        let p = start(PhraseType.PropertyAccessExpression);
        p.children.push(simpleVariable());
        next(); //->
        expect(TokenType.Name);
        return end();
    }

    function heredocStringLiteral() {

        let p = start(PhraseType.HeredocStringLiteral);
        next(); //StartHeredoc
        p.children.push(encapsulatedVariableList(TokenType.EndHeredoc));
        expect(TokenType.EndHeredoc);
        return end();

    }

    function anonymousClassDeclaration() {

        let p = start(PhraseType.AnonymousClassDeclaration);
        p.children.push(anonymousClassDeclarationHeader());
        p.children.push(typeDeclarationBody(
            PhraseType.ClassDeclarationBody, isClassMemberStart, classMemberDeclarationList
        ));
        return end();

    }

    function anonymousClassDeclarationHeader() {

        let p = start(PhraseType.AnonymousClassDeclarationHeader);
        next(); //class

        if (optional(TokenType.OpenParenthesis)) {

            if (isArgumentStart(peek())) {
                p.children.push(argumentList());
            }
            expect(TokenType.CloseParenthesis);
        }

        if (peek().tokenType === TokenType.Extends) {
            p.children.push(classBaseClause());
        }

        if (peek().tokenType === TokenType.Implements) {
            p.children.push(classInterfaceClause());
        }

        return end();

    }

    function classInterfaceClause() {

        let p = start(PhraseType.ClassInterfaceClause);
        next(); //implements
        p.children.push(qualifiedNameList([TokenType.OpenBrace]));
        return end();

    }

    function classMemberDeclarationList() {

        return list(
            PhraseType.ClassMemberDeclarationList,
            classMemberDeclaration,
            isClassMemberStart,
            [TokenType.CloseBrace],
            classMemberDeclarationListRecoverSet
        );

    }

    function isClassMemberStart(t: Token) {
        switch (t.tokenType) {
            case TokenType.Public:
            case TokenType.Protected:
            case TokenType.Private:
            case TokenType.Static:
            case TokenType.Abstract:
            case TokenType.Final:
            case TokenType.Function:
            case TokenType.Var:
            case TokenType.Const:
            case TokenType.Use:
                return true;
            default:
                return false;
        }
    }

    function classMemberDeclaration() {

        let p = start(PhraseType.ErrorClassMemberDeclaration);
        let t = peek();

        switch (t.tokenType) {
            case TokenType.Public:
            case TokenType.Protected:
            case TokenType.Private:
            case TokenType.Static:
            case TokenType.Abstract:
            case TokenType.Final:
                let modifiers = memberModifierList();
                t = peek();
                if (t.tokenType === TokenType.VariableName) {
                    p.children.push(modifiers);
                    return propertyDeclaration(p);
                } else if (t.tokenType === TokenType.Function) {
                    return methodDeclaration(p, modifiers);
                } else if (t.tokenType === TokenType.Const) {
                    p.children.push(modifiers);
                    return classConstDeclaration(p);
                } else {
                    //error
                    p.children.push(modifiers);
                    error();
                    return end();
                }
            case TokenType.Function:
                return methodDeclaration(p, null);
            case TokenType.Var:
                next();
                return propertyDeclaration(p);
            case TokenType.Const:
                return classConstDeclaration(p);
            case TokenType.Use:
                return traitUseClause(p);
            default:
                //should not get here
                throwUnexpectedTokenError(t);
        }

    }

    function throwUnexpectedTokenError(t: Token) {
        throw new Error(`Unexpected token: ${t.tokenType}`);
    }

    function traitUseClause(p: Phrase) {
        p.phraseType = PhraseType.TraitUseClause;
        next(); //use
        p.children.push(qualifiedNameList([TokenType.Semicolon, TokenType.OpenBrace]));
        p.children.push(traitUseSpecification());
        return end();

    }

    function traitUseSpecification() {

        let p = start(PhraseType.TraitUseSpecification);
        let t = expectOneOf([TokenType.Semicolon, TokenType.OpenBrace]);

        if (t && t.tokenType === TokenType.OpenBrace) {
            if (isTraitAdaptationStart(peek())) {
                p.children.push(traitAdaptationList());
            }
            expect(TokenType.CloseBrace);
        }

        return end();

    }

    function traitAdaptationList() {

        return list(
            PhraseType.TraitAdaptationList,
            traitAdaptation,
            isTraitAdaptationStart,
            [TokenType.CloseBrace],

        );

    }

    function isTraitAdaptationStart(t: Token) {
        switch (t.tokenType) {
            case TokenType.Name:
            case TokenType.Backslash:
            case TokenType.Namespace:
                return true;
            default:
                return isSemiReservedToken(t);
        }
    }

    function traitAdaptation() {

        let p = start(PhraseType.ErrorTraitAdaptation);
        let t = peek();
        let t2 = peek(1);

        if (t.tokenType === TokenType.Namespace ||
            t.tokenType === TokenType.Backslash ||
            (t.tokenType === TokenType.Name &&
                (t2.tokenType === TokenType.ColonColon || t2.tokenType === TokenType.Backslash))) {

            p.children.push(methodReference());

            if (peek().tokenType === TokenType.InsteadOf) {
                next();
                return traitPrecedence(p);
            }

        } else if (t.tokenType === TokenType.Name || isSemiReservedToken(t)) {

            let methodRef = start(PhraseType.MethodReference);
            methodRef.children.push(identifier());
            p.children.push(end());
        } else {
            //error
            error();
            return end();
        }

        return traitAlias(p);


    }

    function traitAlias(p: Phrase) {

        p.phraseType = PhraseType.TraitAlias;
        expect(TokenType.As);

        let t = peek();

        if (t.tokenType === TokenType.Name || isReservedToken(t)) {
            p.children.push(identifier());
        } else if (isMemberModifier(t)) {
            next();
            t = peek();
            if (t.tokenType === TokenType.Name || isSemiReservedToken(t)) {
                p.children.push(identifier());
            }
        } else {
            error();
        }

        expect(TokenType.Semicolon);
        return end();

    }

    function traitPrecedence(p: Phrase) {

        p.phraseType = PhraseType.TraitPrecedence;
        p.children.push(qualifiedNameList([TokenType.Semicolon]));
        expect(TokenType.Semicolon);
        return end();

    }

    function methodReference() {

        let p = start(PhraseType.MethodReference);
        p.children.push(qualifiedName());
        expect(TokenType.ColonColon);
        p.children.push(identifier());
        return end();

    }

    function methodDeclarationHeader(memberModifers: Phrase) {

        let p = start(PhraseType.MethodDeclarationHeader, true);
        if (memberModifers) {
            p.children.push(memberModifers);
        }
        next(); //function
        optional(TokenType.Ampersand);
        p.children.push(identifier());
        expect(TokenType.OpenParenthesis);

        if (isParameterStart(peek())) {
            p.children.push(delimitedList(
                PhraseType.ParameterDeclarationList,
                parameterDeclaration,
                isParameterStart,
                TokenType.Comma,
                [TokenType.CloseParenthesis]
            ));
        }

        expect(TokenType.CloseParenthesis);

        if (peek().tokenType === TokenType.Colon) {
            p.children.push(returnType());
        }

        return end();

    }

    function methodDeclaration(p: Phrase, memberModifers: Phrase) {

        p.phraseType = PhraseType.MethodDeclaration;
        p.children.push(methodDeclarationHeader(memberModifers));
        p.children.push(methodDeclarationBody());
        return end();

    }

    function methodDeclarationBody() {
        let p = start(PhraseType.MethodDeclarationBody);

        if (peek().tokenType === TokenType.Semicolon) {
            next();
        } else {
            p.children.push(compoundStatement());
        }
        return end();
    }

    function identifier() {
        let p = start(PhraseType.Identifier);
        let t = peek();
        if (t.tokenType === TokenType.Name || isSemiReservedToken(t)) {
            next();
        } else {
            error();
        }
        return end();
    }

    function interfaceDeclaration() {

        let p = start(PhraseType.InterfaceDeclaration);
        p.children.push(interfaceDeclarationHeader());
        p.children.push(typeDeclarationBody(
            PhraseType.InterfaceDeclarationBody, isClassMemberStart, interfaceMemberDeclarations
        ));
        return end();

    }

    function typeDeclarationBody<T extends Phrase>(phraseType: PhraseType, elementStartPredicate: Predicate, listFunction: () => T) {

        let p = start(phraseType);
        expect(TokenType.OpenBrace);

        if (elementStartPredicate(peek())) {
            p.children.push(listFunction());
        }

        expect(TokenType.CloseBrace);
        return end();

    }

    function interfaceMemberDeclarations() {

        return list(
            PhraseType.InterfaceMemberDeclarationList,
            classMemberDeclaration,
            isClassMemberStart,
            [TokenType.CloseBrace],
            classMemberDeclarationListRecoverSet
        );

    }

    function interfaceDeclarationHeader() {

        let p = start(PhraseType.InterfaceDeclarationHeader);
        next(); //interface
        expect(TokenType.Name);

        if (peek().tokenType === TokenType.Extends) {
            p.children.push(interfaceBaseClause());
        }

        return end();

    }

    function interfaceBaseClause() {

        let p = start(PhraseType.InterfaceBaseClause);
        next(); //extends
        p.children.push(qualifiedNameList([TokenType.OpenBrace]));
        return end();

    }

    function traitDeclaration() {

        let p = start(PhraseType.TraitDeclaration);
        p.children.push(traitDeclarationHeader());
        p.children.push(typeDeclarationBody(
            PhraseType.TraitDeclarationBody, isClassMemberStart, traitMemberDeclarations
        ));
        return end();

    }

    function traitDeclarationHeader() {
        let p = start(PhraseType.TraitDeclarationHeader);
        next(); //trait
        expect(TokenType.Name);
        return end();

    }

    function traitMemberDeclarations() {

        return list(
            PhraseType.TraitMemberDeclarationList,
            classMemberDeclaration,
            isClassMemberStart,
            [TokenType.CloseBrace],
            classMemberDeclarationListRecoverSet
        );

    }

    function functionDeclaration() {

        let p = start(PhraseType.FunctionDeclaration);
        p.children.push(functionDeclarationHeader());
        p.children.push(functionDeclarationBody());
        return end();

    }

    function functionDeclarationBody() {
        let cs = compoundStatement();
        cs.phraseType = PhraseType.FunctionDeclarationBody;
        return cs;
    }

    function functionDeclarationHeader() {

        let p = start(PhraseType.FunctionDeclarationHeader);

        next(); //function
        optional(TokenType.Ampersand);
        expect(TokenType.Name);
        expect(TokenType.OpenParenthesis);

        if (isParameterStart(peek())) {
            p.children.push(delimitedList(
                PhraseType.ParameterDeclarationList,
                parameterDeclaration,
                isParameterStart,
                TokenType.Comma,
                [TokenType.CloseParenthesis]
            ));
        }

        expect(TokenType.CloseParenthesis);

        if (peek().tokenType === TokenType.Colon) {
            p.children.push(returnType());
        }

        return end();

    }

    function isParameterStart(t: Token) {

        switch (t.tokenType) {
            case TokenType.Ampersand:
            case TokenType.Ellipsis:
            case TokenType.VariableName:
                return true;
            default:
                return isTypeDeclarationStart(t);
        }

    }

    function classDeclaration() {

        let p = start(PhraseType.ClassDeclaration);

        p.children.push(classDeclarationHeader());
        p.children.push(typeDeclarationBody(
            PhraseType.ClassDeclarationBody, isClassMemberStart, classMemberDeclarationList
        ));
        return end();

    }

    function classDeclarationHeader() {

        let p = start(PhraseType.ClassDeclarationHeader);
        optionalOneOf([TokenType.Abstract, TokenType.Final]);
        expect(TokenType.Class);
        expect(TokenType.Name);

        if (peek().tokenType === TokenType.Extends) {
            p.children.push(classBaseClause());
        }

        if (peek().tokenType === TokenType.Implements) {
            p.children.push(classInterfaceClause());
        }

        return end();

    }

    function classBaseClause() {
        let p = start(PhraseType.ClassBaseClause);
        next(); //extends
        p.children.push(qualifiedName());
        return end();
    }

    function compoundStatement() {

        let p = start(PhraseType.CompoundStatement);
        expect(TokenType.OpenBrace);

        if (isStatementStart(peek())) {
            p.children.push(statementList([TokenType.CloseBrace]));
        }

        expect(TokenType.CloseBrace);
        return end();

    }

    function statement() {

        let t = peek();

        switch (t.tokenType) {
            case TokenType.Namespace:
                return namespaceDefinition();
            case TokenType.Use:
                return namespaceUseDeclaration();
            case TokenType.HaltCompiler:
                return haltCompilerStatement();
            case TokenType.Const:
                return constDeclaration();
            case TokenType.Function:
                {
                    let p1 = peek(1);
                    if(
                        p1.tokenType === TokenType.OpenParenthesis || 
                        (p1.tokenType === TokenType.Ampersand && peek(2).tokenType === TokenType.OpenParenthesis)
                    ) {
                        //anon fn without assignment
                        return expressionStatement();
                    } else {
                        return functionDeclaration();
                    }
                }
            case TokenType.Class:
            case TokenType.Abstract:
            case TokenType.Final:
                return classDeclaration();
            case TokenType.Trait:
                return traitDeclaration();
            case TokenType.Interface:
                return interfaceDeclaration();
            case TokenType.OpenBrace:
                return compoundStatement();
            case TokenType.If:
                return ifStatement();
            case TokenType.While:
                return whileStatement();
            case TokenType.Do:
                return doStatement();
            case TokenType.For:
                return forStatement();
            case TokenType.Switch:
                return switchStatement();
            case TokenType.Break:
                return breakStatement();
            case TokenType.Continue:
                return continueStatement();
            case TokenType.Return:
                return returnStatement();
            case TokenType.Global:
                return globalDeclaration();
            case TokenType.Static:
                if (peek(1).tokenType === TokenType.VariableName &&
                    [TokenType.Semicolon, TokenType.Comma,
                    TokenType.CloseTag, TokenType.Equals].indexOf(peek(2).tokenType) >= 0) {
                    return functionStaticDeclaration();
                } else {
                    return expressionStatement();
                }
            case TokenType.Text:
            case TokenType.OpenTag:
            case TokenType.CloseTag:
                return inlineText();
            case TokenType.ForEach:
                return foreachStatement();
            case TokenType.Declare:
                return declareStatement();
            case TokenType.Try:
                return tryStatement();
            case TokenType.Throw:
                return throwStatement();
            case TokenType.Goto:
                return gotoStatement();
            case TokenType.Echo:
            case TokenType.OpenTagEcho:
                return echoIntrinsic();
            case TokenType.Unset:
                return unsetIntrinsic();
            case TokenType.Semicolon:
                return nullStatement();
            case TokenType.Name:
                if (peek(1).tokenType === TokenType.Colon) {
                    return namedLabelStatement();
                }
            //fall though
            default:
                return expressionStatement();

        }

    }

    function inlineText() {
        let p = start(PhraseType.InlineText);

        optional(TokenType.CloseTag);
        optional(TokenType.Text);
        optional(TokenType.OpenTag);

        return end();
    }

    function nullStatement() {
        start(PhraseType.NullStatement);
        next(); //;
        return end();
    }

    function isCatchClauseStart(t: Token) {
        return t.tokenType === TokenType.Catch;
    }

    function tryStatement() {

        let p = start(PhraseType.TryStatement);
        next(); //try
        p.children.push(compoundStatement());

        let t = peek();

        if (t.tokenType === TokenType.Catch) {
            p.children.push(list(
                PhraseType.CatchClauseList,
                catchClause,
                isCatchClauseStart
            ));
        } else if (t.tokenType !== TokenType.Finally) {
            error();
        }

        if (peek().tokenType === TokenType.Finally) {
            p.children.push(finallyClause());
        }

        return end();

    }

    function finallyClause() {

        let p = start(PhraseType.FinallyClause);
        next(); //finally
        p.children.push(compoundStatement());
        return end();

    }

    function catchClause() {

        let p = start(PhraseType.CatchClause);
        next(); //catch
        expect(TokenType.OpenParenthesis);
        p.children.push(delimitedList(
            PhraseType.CatchNameList,
            qualifiedName,
            isQualifiedNameStart,
            TokenType.Bar,
            [TokenType.VariableName]
        ));
        expect(TokenType.VariableName);
        expect(TokenType.CloseParenthesis);
        p.children.push(compoundStatement());
        return end();

    }

    function declareDirective() {

        let p = start(PhraseType.DeclareDirective);
        expect(TokenType.Name);
        expect(TokenType.Equals);
        expectOneOf([TokenType.IntegerLiteral, TokenType.FloatingLiteral, TokenType.StringLiteral]);
        return end();

    }

    function declareStatement() {

        let p = start(PhraseType.DeclareStatement);
        next(); //declare
        expect(TokenType.OpenParenthesis);
        p.children.push(declareDirective());
        expect(TokenType.CloseParenthesis);

        let t = peek();

        if (t.tokenType === TokenType.Colon) {

            next(); //:
            p.children.push(statementList([TokenType.EndDeclare]));
            expect(TokenType.EndDeclare);
            expect(TokenType.Semicolon);

        } else if (isStatementStart(t)) {

            p.children.push(statement());

        } else if (t.tokenType === TokenType.Semicolon) {

            next();

        } else {

            error();

        }

        return end();

    }

    function switchStatement() {

        let p = start(PhraseType.SwitchStatement);
        next(); //switch
        expect(TokenType.OpenParenthesis);
        p.children.push(expression(0));
        expect(TokenType.CloseParenthesis);

        let t = expectOneOf([TokenType.Colon, TokenType.OpenBrace]);
        let tCase = peek();

        if (tCase.tokenType === TokenType.Case || tCase.tokenType === TokenType.Default) {
            p.children.push(caseStatements(t && t.tokenType === TokenType.Colon ?
                TokenType.EndSwitch : TokenType.CloseBrace));
        }

        if (t && t.tokenType === TokenType.Colon) {
            expect(TokenType.EndSwitch);
            expect(TokenType.Semicolon);
        } else {
            expect(TokenType.CloseBrace);
        }

        return end();

    }

    function caseStatements(breakOn: TokenType) {

        let p = start(PhraseType.CaseStatementList);
        let t: Token;
        let caseBreakOn = [TokenType.Case, TokenType.Default];
        caseBreakOn.push(breakOn);

        while (true) {
            
            t = peek();

            if (t.tokenType === TokenType.Case) {
                p.children.push(caseStatement(caseBreakOn));
            } else if (t.tokenType === TokenType.Default) {
                p.children.push(defaultStatement(caseBreakOn));
            } else if (breakOn === t.tokenType) {
                break;
            } else {
                error();
                break;
            }

        }

        return end();

    }

    function caseStatement(breakOn: TokenType[]) {

        let p = start(PhraseType.CaseStatement);
        next(); //case
        p.children.push(expression(0));
        expectOneOf([TokenType.Colon, TokenType.Semicolon]);
        if (isStatementStart(peek())) {
            p.children.push(statementList(breakOn));
        }
        return end();

    }

    function defaultStatement(breakOn: TokenType[]) {
        let p = start(PhraseType.DefaultStatement);
        next(); //default
        expectOneOf([TokenType.Colon, TokenType.Semicolon]);
        if (isStatementStart(peek())) {
            p.children.push(statementList(breakOn));
        }
        return end();
    }

    function namedLabelStatement() {

        let p = start(PhraseType.NamedLabelStatement);
        next(); //name
        next(); //:
        return end();
    }

    function gotoStatement() {

        let p = start(PhraseType.GotoStatement);
        next(); //goto
        expect(TokenType.Name);
        expect(TokenType.Semicolon);
        return end();

    }

    function throwStatement() {

        let p = start(PhraseType.ThrowStatement);
        next(); //throw
        p.children.push(expression(0));
        expect(TokenType.Semicolon);
        return end();
    }

    function foreachCollection() {
        let p = start(PhraseType.ForeachCollection);
        p.children.push(expression(0));
        return end();
    }

    function foreachKeyOrValue() {
        let p = start(PhraseType.ForeachValue);
        p.children.push(expression(0));
        if (peek().tokenType === TokenType.FatArrow) {
            next();
            p.phraseType = PhraseType.ForeachKey;
        }
        return end();
    }

    function foreachValue() {
        let p = start(PhraseType.ForeachValue);
        optional(TokenType.Ampersand);
        p.children.push(expression(0));
        return end();
    }

    function foreachStatement() {

        let p = start(PhraseType.ForeachStatement);
        next(); //foreach
        expect(TokenType.OpenParenthesis);
        p.children.push(foreachCollection());
        expect(TokenType.As);
        let keyOrValue = peek().tokenType === TokenType.Ampersand ? foreachValue() : foreachKeyOrValue();
        p.children.push(keyOrValue);

        if (keyOrValue.phraseType === PhraseType.ForeachKey) {
            p.children.push(foreachValue());
        } 

        expect(TokenType.CloseParenthesis);

        let t = peek();

        if (t.tokenType === TokenType.Colon) {
            next();
            p.children.push(statementList([TokenType.EndForeach]));
            expect(TokenType.EndForeach);
            expect(TokenType.Semicolon);
        } else if (isStatementStart(t)) {
            p.children.push(statement());
        } else {
            error();
        }

        return end();

    }

    function isVariableStart(t: Token) {

        switch (t.tokenType) {
            case TokenType.VariableName:
            case TokenType.Dollar:
            case TokenType.OpenParenthesis:
            case TokenType.Array:
            case TokenType.OpenBracket:
            case TokenType.StringLiteral:
            case TokenType.Static:
            case TokenType.Name:
            case TokenType.Namespace:
            case TokenType.Backslash:
                return true;
            default:
                return false;
        }

    }

    function variableInitial() {
        return variable(variableAtom());
    }

    function variableList(breakOn?: TokenType[]) {
        return delimitedList(
            PhraseType.VariableList,
            variableInitial,
            isVariableStart,
            TokenType.Comma,
            breakOn
        );
    }

    function unsetIntrinsic() {

        let p = start(PhraseType.UnsetIntrinsic);
        next(); //unset
        expect(TokenType.OpenParenthesis);
        p.children.push(variableList([TokenType.CloseParenthesis]));
        expect(TokenType.CloseParenthesis);
        expect(TokenType.Semicolon);
        return end();

    }

    function expressionInitial() {
        return expression(0);
    }

    function echoIntrinsic() {

        let p = start(PhraseType.EchoIntrinsic);
        next(); //echo or <?=
        p.children.push(delimitedList(
            PhraseType.ExpressionList,
            expressionInitial,
            isExpressionStart,
            TokenType.Comma
        ));
        expect(TokenType.Semicolon);
        return end();

    }

    function isStaticVariableDclarationStart(t: Token) {
        return t.tokenType === TokenType.VariableName;
    }

    function functionStaticDeclaration() {

        let p = start(PhraseType.FunctionStaticDeclaration);
        next(); //static
        p.children.push(delimitedList(
            PhraseType.StaticVariableDeclarationList,
            staticVariableDeclaration,
            isStaticVariableDclarationStart,
            TokenType.Comma,
            [TokenType.Semicolon]
        ));
        expect(TokenType.Semicolon);
        return end();

    }

    function globalDeclaration() {

        let p = start(PhraseType.GlobalDeclaration);
        next(); //global
        p.children.push(delimitedList(
            PhraseType.VariableNameList,
            simpleVariable,
            isSimpleVariableStart,
            TokenType.Comma,
            [TokenType.Semicolon]
        ));
        expect(TokenType.Semicolon);
        return end();

    }

    function isSimpleVariableStart(t: Token) {
        switch (t.tokenType) {
            case TokenType.VariableName:
            case TokenType.Dollar:
                return true;
            default:
                return false;
        }
    }

    function staticVariableDeclaration() {

        let p = start(PhraseType.StaticVariableDeclaration);
        expect(TokenType.VariableName);

        if (peek().tokenType === TokenType.Equals) {
            p.children.push(functionStaticInitialiser());
        }

        return end();

    }

    function functionStaticInitialiser() {

        let p = start(PhraseType.FunctionStaticInitialiser);
        next(); //=
        p.children.push(expression(0));
        return end();

    }

    function continueStatement() {
        let p = start(PhraseType.ContinueStatement);
        next(); //break/continue
        if(isExpressionStart(peek())) {
            p.children.push(expression(0));
        }
        expect(TokenType.Semicolon);
        return end();
    }

    function breakStatement() {
        let p = start(PhraseType.BreakStatement);
        next(); //break/continue
        if(isExpressionStart(peek())) {
            p.children.push(expression(0));
        }
        expect(TokenType.Semicolon);
        return end();
    }

    function returnStatement() {
        let p = start(PhraseType.ReturnStatement);
        next(); //return

        if (isExpressionStart(peek())) {
            p.children.push(expression(0));
        }

        expect(TokenType.Semicolon);
        return end();
    }

    function forExpressionGroup(phraseType: PhraseType, breakOn: TokenType[]) {

        return delimitedList(
            phraseType,
            expressionInitial,
            isExpressionStart,
            TokenType.Comma,
            breakOn
        );

    }

    function forStatement() {

        let p = start(PhraseType.ForStatement);
        next(); //for
        expect(TokenType.OpenParenthesis);

        if (isExpressionStart(peek())) {
            p.children.push(forExpressionGroup(PhraseType.ForInitialiser, [TokenType.Semicolon]));
        }

        expect(TokenType.Semicolon);

        if (isExpressionStart(peek())) {
            p.children.push(forExpressionGroup(PhraseType.ForControl, [TokenType.Semicolon]));
        }

        expect(TokenType.Semicolon);

        if (isExpressionStart(peek())) {
            p.children.push(forExpressionGroup(PhraseType.ForEndOfLoop, [TokenType.CloseParenthesis]));
        }

        expect(TokenType.CloseParenthesis);

        let t = peek();

        if (t.tokenType === TokenType.Colon) {
            next();
            p.children.push(statementList([TokenType.EndFor]));
            expect(TokenType.EndFor);
            expect(TokenType.Semicolon);
        } else if (isStatementStart(peek())) {
            p.children.push(statement());
        } else {
            error();
        }

        return end();

    }

    function doStatement() {

        let p = start(PhraseType.DoStatement);
        next(); // do
        p.children.push(statement());
        expect(TokenType.While);
        expect(TokenType.OpenParenthesis);
        p.children.push(expression(0));
        expect(TokenType.CloseParenthesis);
        expect(TokenType.Semicolon);
        return end();

    }

    function whileStatement() {

        let p = start(PhraseType.WhileStatement);
        next(); //while
        expect(TokenType.OpenParenthesis);
        p.children.push(expression(0));
        expect(TokenType.CloseParenthesis);

        let t = peek();

        if (t.tokenType === TokenType.Colon) {
            next();
            p.children.push(statementList([TokenType.EndWhile]));
            expect(TokenType.EndWhile);
            expect(TokenType.Semicolon);
        } else if (isStatementStart(t)) {
            p.children.push(statement());
        } else {
            //error
            error();
        }

        return end();

    }

    function elseIfClause1() {

        let p = start(PhraseType.ElseIfClause);
        next(); //elseif
        expect(TokenType.OpenParenthesis);
        p.children.push(expression(0));
        expect(TokenType.CloseParenthesis);
        p.children.push(statement());
        return end();
    }

    function elseIfClause2() {
        let p = start(PhraseType.ElseIfClause);
        next(); //elseif
        expect(TokenType.OpenParenthesis);
        p.children.push(expression(0));
        expect(TokenType.CloseParenthesis);
        expect(TokenType.Colon);
        p.children.push(statementList([TokenType.EndIf, TokenType.Else, TokenType.ElseIf]));
        return end();
    }

    function elseClause1() {
        let p = start(PhraseType.ElseClause);
        next(); //else
        p.children.push(statement());
        return end();
    }

    function elseClause2() {
        let p = start(PhraseType.ElseClause);
        next(); //else
        expect(TokenType.Colon);
        p.children.push(statementList([TokenType.EndIf]));
        return end();
    }

    function isElseIfClauseStart(t: Token) {
        return t.tokenType === TokenType.ElseIf;
    }

    function ifStatement() {

        let p = start(PhraseType.IfStatement);
        next(); //if
        expect(TokenType.OpenParenthesis);
        p.children.push(expression(0));
        expect(TokenType.CloseParenthesis);

        let t = peek();
        let elseIfClauseFunction = elseIfClause1;
        let elseClauseFunction = elseClause1;
        let expectEndIf = false;

        if (t.tokenType === TokenType.Colon) {
            next();
            p.children.push(statementList([TokenType.ElseIf, TokenType.Else, TokenType.EndIf]));
            elseIfClauseFunction = elseIfClause2;
            elseClauseFunction = elseClause2;
            expectEndIf = true;
        } else if (isStatementStart(t)) {
            p.children.push(statement());
        } else {
            error();
        }

        if (peek().tokenType === TokenType.ElseIf) {
            p.children.push(list(
                PhraseType.ElseIfClauseList,
                elseIfClauseFunction,
                isElseIfClauseStart
            ));
        }

        if (peek().tokenType === TokenType.Else) {
            p.children.push(elseClauseFunction());
        }

        if (expectEndIf) {
            expect(TokenType.EndIf);
            expect(TokenType.Semicolon);
        }

        return end();

    }

    function expressionStatement() {

        let p = start(PhraseType.ExpressionStatement);
        p.children.push(expression(0));
        expect(TokenType.Semicolon);
        return end();

    }

    function returnType() {
        let p = start(PhraseType.ReturnType);
        next(); //:
        p.children.push(typeDeclaration());
        return end();
    }

    function typeDeclaration() {

        let p = start(PhraseType.TypeDeclaration);
        optional(TokenType.Question);

        switch (peek().tokenType) {
            case TokenType.Callable:
            case TokenType.Array:
                next();
                break;
            case TokenType.Name:
            case TokenType.Namespace:
            case TokenType.Backslash:
                p.children.push(qualifiedName());
                break;
            default:
                error();
                break;
        }

        return end();

    }

    function classConstDeclaration(p: Phrase) {

        p.phraseType = PhraseType.ClassConstDeclaration;
        next(); //const
        p.children.push(delimitedList(
            PhraseType.ClassConstElementList,
            classConstElement,
            isClassConstElementStartToken,
            TokenType.Comma,
            [TokenType.Semicolon]
        ));
        expect(TokenType.Semicolon);
        return end();

    }

    function isExpressionStart(t: Token) {

        switch (t.tokenType) {
            case TokenType.VariableName:
            case TokenType.Dollar:
            case TokenType.Array:
            case TokenType.OpenBracket:
            case TokenType.StringLiteral:
            case TokenType.Backslash:
            case TokenType.Name:
            case TokenType.Namespace:
            case TokenType.OpenParenthesis:
            case TokenType.Static:
            case TokenType.PlusPlus:
            case TokenType.MinusMinus:
            case TokenType.Plus:
            case TokenType.Minus:
            case TokenType.Exclamation:
            case TokenType.Tilde:
            case TokenType.AtSymbol:
            case TokenType.IntegerCast:
            case TokenType.FloatCast:
            case TokenType.StringCast:
            case TokenType.ArrayCast:
            case TokenType.ObjectCast:
            case TokenType.BooleanCast:
            case TokenType.UnsetCast:
            case TokenType.List:
            case TokenType.Clone:
            case TokenType.New:
            case TokenType.FloatingLiteral:
            case TokenType.IntegerLiteral:
            case TokenType.LineConstant:
            case TokenType.FileConstant:
            case TokenType.DirectoryConstant:
            case TokenType.TraitConstant:
            case TokenType.MethodConstant:
            case TokenType.FunctionConstant:
            case TokenType.NamespaceConstant:
            case TokenType.ClassConstant:
            case TokenType.StartHeredoc:
            case TokenType.DoubleQuote:
            case TokenType.Backtick:
            case TokenType.Print:
            case TokenType.Yield:
            case TokenType.YieldFrom:
            case TokenType.Function:
            case TokenType.Include:
            case TokenType.IncludeOnce:
            case TokenType.Require:
            case TokenType.RequireOnce:
            case TokenType.Eval:
            case TokenType.Empty:
            case TokenType.Isset:
            case TokenType.Exit:
                return true;
            default:
                return false;
        }

    }

    function classConstElement() {

        let p = start(PhraseType.ClassConstElement);
        p.children.push(identifier());
        expect(TokenType.Equals);
        p.children.push(expression(0));
        return end();

    }

    function isPropertyElementStart(t: Token) {
        return t.tokenType === TokenType.VariableName;
    }

    function propertyDeclaration(p: Phrase) {

        let t: Token;
        p.phraseType = PhraseType.PropertyDeclaration;
        p.children.push(delimitedList(
            PhraseType.PropertyElementList,
            propertyElement,
            isPropertyElementStart,
            TokenType.Comma,
            [TokenType.Semicolon]
        ));
        expect(TokenType.Semicolon);
        return end();

    }

    function propertyElement() {

        let p = start(PhraseType.PropertyElement);
        expect(TokenType.VariableName);

        if (peek().tokenType === TokenType.Equals) {
            p.children.push(propertyInitialiser());
        }

        return end();

    }

    function propertyInitialiser() {

        let p = start(PhraseType.PropertyInitialiser);
        next(); //equals
        p.children.push(expression(0));
        return end();

    }

    function memberModifierList() {

        let p = start(PhraseType.MemberModifierList);

        while (isMemberModifier(peek())) {
            next();
        }

        return end();

    }

    function isMemberModifier(t: Token) {
        switch (t.tokenType) {
            case TokenType.Public:
            case TokenType.Protected:
            case TokenType.Private:
            case TokenType.Static:
            case TokenType.Abstract:
            case TokenType.Final:
                return true;
            default:
                return false;
        }
    }


    function qualifiedNameList(breakOn: TokenType[]) {

        return delimitedList(
            PhraseType.QualifiedNameList,
            qualifiedName,
            isQualifiedNameStart,
            TokenType.Comma,
            breakOn
        );
    }

    function objectCreationExpression() {

        let p = start(PhraseType.ObjectCreationExpression);
        next(); //new

        if (peek().tokenType === TokenType.Class) {
            p.children.push(anonymousClassDeclaration());
            return end();
        }

        p.children.push(typeDesignator(PhraseType.ClassTypeDesignator));

        if (optional(TokenType.OpenParenthesis)) {

            if (isArgumentStart(peek())) {
                p.children.push(argumentList());
            }

            expect(TokenType.CloseParenthesis);
        }

        return end();

    }

    function typeDesignator(phraseType: PhraseType) {

        let p = start(phraseType);
        let part = classTypeDesignatorAtom();

        while (true) {
            
            switch (peek().tokenType) {
                case TokenType.OpenBracket:
                    part = subscriptExpression(part, TokenType.CloseBracket);
                    continue;
                case TokenType.OpenBrace:
                    part = subscriptExpression(part, TokenType.CloseBrace);
                    continue;
                case TokenType.Arrow:
                    part = propertyAccessExpression(part);
                    continue;
                case TokenType.ColonColon:
                    let staticPropNode = start(PhraseType.ScopedPropertyAccessExpression);
                    staticPropNode.children.push(part);
                    next(); //::
                    staticPropNode.children.push(restrictedScopedMemberName());
                    part = end();
                    continue;
                default:
                    break;
            }

            break;

        }

        p.children.push(part);
        return end();

    }

    function restrictedScopedMemberName() {

        let p = start(PhraseType.ScopedMemberName);
        let t = peek();

        switch (t.tokenType) {
            case TokenType.VariableName:
                //Spec says this should be SimpleVariable
                //leaving as a token as this avoids confusion between 
                //static property names and simple variables
                next();
                break;
            case TokenType.Dollar:
                p.children.push(simpleVariable());
                break;
            default:
                error();
                break;
        }

        return end();

    }

    function classTypeDesignatorAtom() {

        let t = peek();

        switch (t.tokenType) {
            case TokenType.Static:
                return relativeScope();
            case TokenType.VariableName:
            case TokenType.Dollar:
                return simpleVariable();
            case TokenType.Name:
            case TokenType.Namespace:
            case TokenType.Backslash:
                return qualifiedName();
            default:
                start(PhraseType.ErrorClassTypeDesignatorAtom);
                error();
                return end();
        }

    }

    function cloneExpression() {

        let p = start(PhraseType.CloneExpression);
        next(); //clone
        p.children.push(expression(0));
        return end();

    }

    function listIntrinsic() {

        let p = start(PhraseType.ListIntrinsic);
        next(); //list
        expect(TokenType.OpenParenthesis);
        p.children.push(arrayInitialiserList(TokenType.CloseParenthesis));
        expect(TokenType.CloseParenthesis);
        return end();

    }

    function unaryExpression(phraseType: PhraseType) {

        let p = start(phraseType);
        let op = next();//op

        switch (phraseType) {
            case PhraseType.PrefixDecrementExpression:
            case PhraseType.PrefixIncrementExpression:
                p.children.push(variable(variableAtom()));
                break;
            default:
                p.children.push(expression(precedenceAssociativityTuple(op)[0]));
                break;
        }

        return end();

    }

    function anonymousFunctionHeader() {
        let p = start(PhraseType.AnonymousFunctionHeader);
        optional(TokenType.Static);
        next(); //function
        optional(TokenType.Ampersand);
        expect(TokenType.OpenParenthesis);

        if (isParameterStart(peek())) {
            p.children.push(delimitedList(
                PhraseType.ParameterDeclarationList,
                parameterDeclaration,
                isParameterStart,
                TokenType.Comma,
                [TokenType.CloseParenthesis]
            ));
        }

        expect(TokenType.CloseParenthesis);

        if (peek().tokenType === TokenType.Use) {
            p.children.push(anonymousFunctionUseClause());
        }

        if (peek().tokenType === TokenType.Colon) {
            p.children.push(returnType());
        }

        return end();

    }

    function anonymousFunctionCreationExpression() {

        let p = start(PhraseType.AnonymousFunctionCreationExpression);

        p.children.push(anonymousFunctionHeader());
        p.children.push(functionDeclarationBody());
        return end();

    }

    function isAnonymousFunctionUseVariableStart(t: Token) {
        return t.tokenType === TokenType.VariableName ||
            t.tokenType === TokenType.Ampersand;
    }

    function anonymousFunctionUseClause() {

        let p = start(PhraseType.AnonymousFunctionUseClause);
        next(); //use
        expect(TokenType.OpenParenthesis);
        p.children.push(delimitedList(
            PhraseType.ClosureUseList,
            anonymousFunctionUseVariable,
            isAnonymousFunctionUseVariableStart,
            TokenType.Comma,
            [TokenType.CloseParenthesis]
        ));
        expect(TokenType.CloseParenthesis);
        return end();

    }

    function anonymousFunctionUseVariable() {

        let p = start(PhraseType.AnonymousFunctionUseVariable);
        optional(TokenType.Ampersand);
        expect(TokenType.VariableName);
        return end();

    }

    function isTypeDeclarationStart(t: Token) {
        switch (t.tokenType) {
            case TokenType.Backslash:
            case TokenType.Name:
            case TokenType.Namespace:
            case TokenType.Question:
            case TokenType.Array:
            case TokenType.Callable:
                return true;
            default:
                return false;
        }
    }

    function parameterDeclaration() {

        let p = start(PhraseType.ParameterDeclaration);

        if (isTypeDeclarationStart(peek())) {
            p.children.push(typeDeclaration());
        }

        optional(TokenType.Ampersand);
        optional(TokenType.Ellipsis);
        expect(TokenType.VariableName);

        if (peek().tokenType === TokenType.Equals) {
            next();
            p.children.push(expression(0));
        }

        return end();

    }

    function variable(variableAtomNode: Phrase | Token) {

        let count = 0;

        while (true) {
            ++count;
            switch (peek().tokenType) {
                case TokenType.ColonColon:
                    variableAtomNode = scopedAccessExpression(variableAtomNode);
                    continue;
                case TokenType.Arrow:
                    variableAtomNode = propertyOrMethodAccessExpression(variableAtomNode);
                    continue;
                case TokenType.OpenBracket:
                    variableAtomNode = subscriptExpression(variableAtomNode, TokenType.CloseBracket);
                    continue;
                case TokenType.OpenBrace:
                    variableAtomNode = subscriptExpression(variableAtomNode, TokenType.CloseBrace);
                    continue;
                case TokenType.OpenParenthesis:
                    variableAtomNode = functionCallExpression(variableAtomNode);
                    continue;
                default:
                    //only simple variable atoms qualify as variables
                    if (count === 1 && (<Phrase>variableAtomNode).phraseType !== PhraseType.SimpleVariable) {
                        let errNode = start(PhraseType.ErrorVariable, true);
                        errNode.children.push(variableAtomNode);
                        error();
                        return end();
                    }
                    break;
            }

            break;
        }

        return variableAtomNode;
    }

    function functionCallExpression(lhs: Phrase | Token) {
        let p = start(PhraseType.FunctionCallExpression, true);
        p.children.push(lhs);
        expect(TokenType.OpenParenthesis);
        if (isArgumentStart(peek())) {
            p.children.push(argumentList());
        }
        expect(TokenType.CloseParenthesis);
        return end();
    }

    function scopedAccessExpression(lhs: Phrase | Token) {

        let p = start(PhraseType.ErrorScopedAccessExpression, true);
        p.children.push(lhs);
        next() //::
        p.children.push(scopedMemberName(p));

        if (optional(TokenType.OpenParenthesis)) {
            p.phraseType = PhraseType.ScopedCallExpression;
            if (isArgumentStart(peek())) {
                p.children.push(argumentList());
            }

            expect(TokenType.CloseParenthesis);
            return end();
        } else if (p.phraseType === PhraseType.ScopedCallExpression) {
            //error
            error();
        }

        return end();

    }

    function scopedMemberName(parent: Phrase) {

        let p = start(PhraseType.ScopedMemberName);
        let t = peek();

        switch (t.tokenType) {
            case TokenType.OpenBrace:
                parent.phraseType = PhraseType.ScopedCallExpression;
                p.children.push(encapsulatedExpression(TokenType.OpenBrace, TokenType.CloseBrace));
                break;
            case TokenType.VariableName:
                //Spec says this should be SimpleVariable
                //leaving as a token as this avoids confusion between 
                //static property names and simple variables
                parent.phraseType = PhraseType.ScopedPropertyAccessExpression;
                next();
                break;
            case TokenType.Dollar:
                p.children.push(simpleVariable());
                parent.phraseType = PhraseType.ScopedPropertyAccessExpression;
                break;
            default:
                if (t.tokenType === TokenType.Name || isSemiReservedToken(t)) {
                    p.children.push(identifier());
                    parent.phraseType = PhraseType.ClassConstantAccessExpression;
                } else {
                    //error
                    error();
                }
                break;
        }

        return end();

    }

    function propertyAccessExpression(lhs: Phrase | Token) {
        let p = start(PhraseType.PropertyAccessExpression, true);
        p.children.push(lhs);
        next(); //->
        p.children.push(memberName());
        return end();
    }

    function propertyOrMethodAccessExpression(lhs: Phrase | Token) {

        let p = start(PhraseType.PropertyAccessExpression, true);
        p.children.push(lhs);
        next(); //->
        p.children.push(memberName());

        if (optional(TokenType.OpenParenthesis)) {
            if (isArgumentStart(peek())) {
                p.children.push(argumentList());
            }
            p.phraseType = PhraseType.MethodCallExpression;
            expect(TokenType.CloseParenthesis);
        }

        return end();

    }

    function memberName() {

        let p = start(PhraseType.MemberName);

        switch (peek().tokenType) {
            case TokenType.Name:
                next();
                break;
            case TokenType.OpenBrace:
                p.children.push(encapsulatedExpression(TokenType.OpenBrace, TokenType.CloseBrace));
                break;
            case TokenType.Dollar:
            case TokenType.VariableName:
                p.children.push(simpleVariable());
                break;
            default:
                error();
                break;
        }

        return end();

    }

    function subscriptExpression(lhs: Phrase | Token, closeTokenType: TokenType) {

        let p = start(PhraseType.SubscriptExpression, true);
        p.children.push(lhs);
        next(); // [ or {

        if (isExpressionStart(peek())) {
            p.children.push(expression(0));
        }

        expect(closeTokenType);
        return end();

    }

    function argumentList() {

        return delimitedList(
            PhraseType.ArgumentExpressionList,
            argumentExpression,
            isArgumentStart,
            TokenType.Comma,
            [TokenType.CloseParenthesis]
        );

    }

    function isArgumentStart(t: Token) {
        return t.tokenType === TokenType.Ellipsis || isExpressionStart(t);
    }

    function variadicUnpacking() {
        let p = start(PhraseType.VariadicUnpacking);
        next(); //...
        p.children.push(expression(0));
        return end();
    }

    function argumentExpression() {
        return peek().tokenType === TokenType.Ellipsis ?
            variadicUnpacking() : expression(0);
    }

    function qualifiedName() {

        let p = start(PhraseType.QualifiedName);
        let t = peek();

        if (t.tokenType === TokenType.Backslash) {
            next();
            p.phraseType = PhraseType.FullyQualifiedName;
        } else if (t.tokenType === TokenType.Namespace) {
            p.phraseType = PhraseType.RelativeQualifiedName;
            next();
            expect(TokenType.Backslash);
        }

        p.children.push(namespaceName());
        return end();

    }

    function isQualifiedNameStart(t: Token) {
        switch (t.tokenType) {
            case TokenType.Backslash:
            case TokenType.Name:
            case TokenType.Namespace:
                return true;
            default:
                return false;
        }
    }

    function shortArrayCreationExpression() {

        let p = start(PhraseType.ArrayCreationExpression);
        next(); //[
        if (isArrayElementStart(peek())) {
            p.children.push(arrayInitialiserList(TokenType.CloseBracket));
        }
        expect(TokenType.CloseBracket);
        return end();

    }

    function longArrayCreationExpression() {

        let p = start(PhraseType.ArrayCreationExpression);
        next(); //array
        expect(TokenType.OpenParenthesis);

        if (isArrayElementStart(peek())) {
            p.children.push(arrayInitialiserList(TokenType.CloseParenthesis));
        }

        expect(TokenType.CloseParenthesis);
        return end();

    }

    function isArrayElementStart(t: Token) {
        return t.tokenType === TokenType.Ampersand || isExpressionStart(t);
    }

    function arrayInitialiserList(breakOn: TokenType) {

        let p = start(PhraseType.ArrayInitialiserList);
        let t: Token;

        let arrayInitialiserListRecoverSet = [breakOn, TokenType.Comma];
        recoverSetStack.push(arrayInitialiserListRecoverSet);

        while (true) {
            
            //an array can have empty elements
            if (isArrayElementStart(peek())) {
                p.children.push(arrayElement());
            }

            t = peek();

            if (t.tokenType === TokenType.Comma) {
                next();
            } else if (t.tokenType === breakOn) {
                break;
            } else {
                error();
                //check for missing delimeter
                if (isArrayElementStart(t)) {
                    continue;
                } else {
                    //skip until recover token
                    defaultSyncStrategy();
                    t = peek();
                    if (t.tokenType === TokenType.Comma || t.tokenType === breakOn) {
                        continue;
                    }
                }

                break;
            }

        }

        recoverSetStack.pop();
        return end();

    }

    function arrayValue() {

        let p = start(PhraseType.ArrayValue);
        optional(TokenType.Ampersand)
        p.children.push(expression(0));
        return end();

    }

    function arrayKey() {
        let p = start(PhraseType.ArrayKey);
        p.children.push(expression(0));
        return end();
    }

    function arrayElement() {

        let p = start(PhraseType.ArrayElement);

        if (peek().tokenType === TokenType.Ampersand) {
            p.children.push(arrayValue());
            return end();
        }

        let keyOrValue = arrayKey();
        p.children.push(keyOrValue);

        if (!optional(TokenType.FatArrow)) {
            keyOrValue.phraseType = PhraseType.ArrayValue;
            return end();
        }

        p.children.push(arrayValue());
        return end();

    }

    function encapsulatedExpression(openTokenType: TokenType, closeTokenType: TokenType) {

        let p = start(PhraseType.EncapsulatedExpression);
        expect(openTokenType);
        p.children.push(expression(0));
        expect(closeTokenType);
        return end();

    }

    function relativeScope() {
        let p = start(PhraseType.RelativeScope);
        next();
        return end();
    }

    function variableAtom(): Phrase | Token {

        let t = peek();
        switch (t.tokenType) {
            case TokenType.VariableName:
            case TokenType.Dollar:
                return simpleVariable();
            case TokenType.OpenParenthesis:
                return encapsulatedExpression(TokenType.OpenParenthesis, TokenType.CloseParenthesis);
            case TokenType.Array:
                return longArrayCreationExpression();
            case TokenType.OpenBracket:
                return shortArrayCreationExpression();
            case TokenType.StringLiteral:
                return next(true);
            case TokenType.Static:
                return relativeScope();
            case TokenType.Name:
            case TokenType.Namespace:
            case TokenType.Backslash:
                return qualifiedName();
            default:
                //error
                let p = start(PhraseType.ErrorVariableAtom);
                error();
                return end();
        }

    }

    function simpleVariable() {

        let p = start(PhraseType.SimpleVariable);
        let t = expectOneOf([TokenType.VariableName, TokenType.Dollar]);

        if (t && t.tokenType === TokenType.Dollar) {
            t = peek();
            if (t.tokenType === TokenType.OpenBrace) {
                p.children.push(encapsulatedExpression(TokenType.OpenBrace, TokenType.CloseBrace));
            } else if (t.tokenType === TokenType.Dollar || t.tokenType === TokenType.VariableName) {
                p.children.push(simpleVariable());
            } else {
                error();
            }
        }

        return end();

    }

    function haltCompilerStatement() {

        let p = start(PhraseType.HaltCompilerStatement);
        next(); // __halt_compiler
        expect(TokenType.OpenParenthesis);
        expect(TokenType.CloseParenthesis);
        expect(TokenType.Semicolon);
        return end();

    }

    function namespaceUseDeclaration() {

        let p = start(PhraseType.NamespaceUseDeclaration);
        next(); //use
        optionalOneOf([TokenType.Function, TokenType.Const]);
        optional(TokenType.Backslash);
        let nsNameNode = namespaceName();
        let t = peek();

        if (t.tokenType === TokenType.Backslash || t.tokenType === TokenType.OpenBrace) {
            p.children.push(nsNameNode);
            expect(TokenType.Backslash);
            expect(TokenType.OpenBrace);
            p.children.push(delimitedList(
                PhraseType.NamespaceUseGroupClauseList,
                namespaceUseGroupClause,
                isNamespaceUseGroupClauseStartToken,
                TokenType.Comma,
                [TokenType.CloseBrace]
            ));
            expect(TokenType.CloseBrace);
            expect(TokenType.Semicolon);
            return end();
        }

        p.children.push(delimitedList(
            PhraseType.NamespaceUseClauseList,
            namespaceUseClauseFunction(nsNameNode),
            isNamespaceUseClauseStartToken,
            TokenType.Comma,
            [TokenType.Semicolon],
            true));

        expect(TokenType.Semicolon);
        return end();

    }

    function isNamespaceUseClauseStartToken(t:Token) {
        return t.tokenType === TokenType.Name || t.tokenType === TokenType.Backslash;
    }

    function namespaceUseClauseFunction(nsName: Phrase) {

        return () => {

            let p = start(PhraseType.NamespaceUseClause, !!nsName);

            if (nsName) {
                p.children.push(nsName);
                nsName = null;
            } else {
                p.children.push(namespaceName());
            }

            if (peek().tokenType === TokenType.As) {
                p.children.push(namespaceAliasingClause());
            }

            return end();

        };

    }

    function delimitedList(phraseType: PhraseType, elementFunction: () => Phrase | Token,
        elementStartPredicate: Predicate, delimiter: TokenType, breakOn?: TokenType[], doNotPushHiddenToParent?:boolean) {
        let p = start(phraseType, doNotPushHiddenToParent);
        let t: Token;
        let delimitedListRecoverSet = breakOn ? breakOn.slice(0) : [];
        delimitedListRecoverSet.push(delimiter);
        recoverSetStack.push(delimitedListRecoverSet);

        while (true) {
            
            p.children.push(elementFunction());
            t = peek();
            
            if (t.tokenType === delimiter) {
                next();
            } else if (!breakOn || breakOn.indexOf(t.tokenType) >= 0) {
                break;
            } else {
                error();
                //check for missing delimeter
                if (elementStartPredicate(t)) {
                    continue;
                } else if (breakOn) {
                    //skip until breakOn or delimiter token or whatever else is in recover set
                    defaultSyncStrategy();
                    if (peek().tokenType === delimiter) {
                        continue;
                    }
                }

                break;
            }

        }

        recoverSetStack.pop();
        return end();
    }

    function isNamespaceUseGroupClauseStartToken(t: Token) {
        switch (t.tokenType) {
            case TokenType.Const:
            case TokenType.Function:
            case TokenType.Name:
                return true;
            default:
                return false;
        }
    }

    function namespaceUseGroupClause() {

        let p = start(PhraseType.NamespaceUseGroupClause);
        optionalOneOf([TokenType.Function, TokenType.Const]);
        p.children.push(namespaceName());

        if (peek().tokenType === TokenType.As) {
            p.children.push(namespaceAliasingClause());
        }

        return end();

    }

    function namespaceAliasingClause() {

        let p = start(PhraseType.NamespaceAliasingClause);
        next(); //as
        expect(TokenType.Name);
        return end();

    }

    function namespaceDefinition() {

        let p = start(PhraseType.NamespaceDefinition);
        next(); //namespace

        if (peek().tokenType === TokenType.Name) {

            p.children.push(namespaceName());
            let t = expectOneOf([TokenType.Semicolon, TokenType.OpenBrace]);
            if (!t || t.tokenType !== TokenType.OpenBrace) {
                return end();
            }

        } else {
            expect(TokenType.OpenBrace);
        }

        p.children.push(statementList([TokenType.CloseBrace]));
        expect(TokenType.CloseBrace);
        return end();

    }

    function namespaceName() {

        start(PhraseType.NamespaceName);
        expect(TokenType.Name);

        while (true) {
            
            if (peek().tokenType === TokenType.Backslash &&
                peek(1).tokenType === TokenType.Name) {
                next();
                next();
            } else {
                break;
            }

        }

        return end();

    }

    function isReservedToken(t: Token) {
        switch (t.tokenType) {
            case TokenType.Include:
            case TokenType.IncludeOnce:
            case TokenType.Eval:
            case TokenType.Require:
            case TokenType.RequireOnce:
            case TokenType.Or:
            case TokenType.Xor:
            case TokenType.And:
            case TokenType.InstanceOf:
            case TokenType.New:
            case TokenType.Clone:
            case TokenType.Exit:
            case TokenType.If:
            case TokenType.ElseIf:
            case TokenType.Else:
            case TokenType.EndIf:
            case TokenType.Echo:
            case TokenType.Do:
            case TokenType.While:
            case TokenType.EndWhile:
            case TokenType.For:
            case TokenType.EndFor:
            case TokenType.ForEach:
            case TokenType.EndForeach:
            case TokenType.Declare:
            case TokenType.EndDeclare:
            case TokenType.As:
            case TokenType.Try:
            case TokenType.Catch:
            case TokenType.Finally:
            case TokenType.Throw:
            case TokenType.Use:
            case TokenType.InsteadOf:
            case TokenType.Global:
            case TokenType.Var:
            case TokenType.Unset:
            case TokenType.Isset:
            case TokenType.Empty:
            case TokenType.Continue:
            case TokenType.Goto:
            case TokenType.Function:
            case TokenType.Const:
            case TokenType.Return:
            case TokenType.Print:
            case TokenType.Yield:
            case TokenType.List:
            case TokenType.Switch:
            case TokenType.EndSwitch:
            case TokenType.Case:
            case TokenType.Default:
            case TokenType.Break:
            case TokenType.Array:
            case TokenType.Callable:
            case TokenType.Extends:
            case TokenType.Implements:
            case TokenType.Namespace:
            case TokenType.Trait:
            case TokenType.Interface:
            case TokenType.Class:
            case TokenType.ClassConstant:
            case TokenType.TraitConstant:
            case TokenType.FunctionConstant:
            case TokenType.MethodConstant:
            case TokenType.LineConstant:
            case TokenType.FileConstant:
            case TokenType.DirectoryConstant:
            case TokenType.NamespaceConstant:
                return true;
            default:
                return false;
        }
    }

    function isSemiReservedToken(t: Token) {
        switch (t.tokenType) {
            case TokenType.Static:
            case TokenType.Abstract:
            case TokenType.Final:
            case TokenType.Private:
            case TokenType.Protected:
            case TokenType.Public:
                return true;
            default:
                return isReservedToken(t);
        }
    }

    function isStatementStart(t: Token) {

        switch (t.tokenType) {
            case TokenType.Namespace:
            case TokenType.Use:
            case TokenType.HaltCompiler:
            case TokenType.Const:
            case TokenType.Function:
            case TokenType.Class:
            case TokenType.Abstract:
            case TokenType.Final:
            case TokenType.Trait:
            case TokenType.Interface:
            case TokenType.OpenBrace:
            case TokenType.If:
            case TokenType.While:
            case TokenType.Do:
            case TokenType.For:
            case TokenType.Switch:
            case TokenType.Break:
            case TokenType.Continue:
            case TokenType.Return:
            case TokenType.Global:
            case TokenType.Static:
            case TokenType.Echo:
            case TokenType.Unset:
            case TokenType.ForEach:
            case TokenType.Declare:
            case TokenType.Try:
            case TokenType.Throw:
            case TokenType.Goto:
            case TokenType.Name:
            case TokenType.Semicolon:
            case TokenType.CloseTag:
            case TokenType.Text:
            case TokenType.OpenTag:
            case TokenType.OpenTagEcho:
                return true;
            default:
                return isExpressionStart(t);
        }
    }

}
