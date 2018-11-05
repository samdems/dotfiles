/* Copyright (c) Ben Robert Mewburn 
 * Licensed under the ISC Licence.
 */

'use strict';

import { Token, TokenType } from './lexer';

export const enum PhraseType {
    Unknown,
    AdditiveExpression,
    AnonymousClassDeclaration,
    AnonymousClassDeclarationHeader,
    AnonymousFunctionCreationExpression,
    AnonymousFunctionHeader,
    AnonymousFunctionUseClause,
    AnonymousFunctionUseVariable,
    ArgumentExpressionList,
    ArrayCreationExpression,
    ArrayElement,
    ArrayInitialiserList,
    ArrayKey,
    ArrayValue,
    BitwiseExpression,
    BreakStatement,
    ByRefAssignmentExpression,
    CaseStatement,
    CaseStatementList,
    CastExpression,
    CatchClause,
    CatchClauseList,
    CatchNameList,
    ClassBaseClause,
    ClassConstantAccessExpression,
    ClassConstDeclaration,
    ClassConstElement,
    ClassConstElementList,
    ClassDeclaration,
    ClassDeclarationBody,
    ClassDeclarationHeader,
    ClassInterfaceClause,
    ClassMemberDeclarationList,
    ClassModifiers,
    ClassTypeDesignator,
    CloneExpression,
    ClosureUseList,
    CoalesceExpression,
    CompoundAssignmentExpression,
    CompoundStatement,
    TernaryExpression,
    ConstantAccessExpression,
    ConstDeclaration,
    ConstElement,
    ConstElementList,
    ContinueStatement,
    DeclareDirective,
    DeclareStatement,
    DefaultStatement,
    DoStatement,
    DoubleQuotedStringLiteral,
    EchoIntrinsic,
    ElseClause,
    ElseIfClause,
    ElseIfClauseList,
    EmptyIntrinsic,
    EncapsulatedExpression,
    EncapsulatedVariable,
    EncapsulatedVariableList,
    EqualityExpression,
    Error,
    ErrorClassMemberDeclaration,
    ErrorClassTypeDesignatorAtom,
    ErrorControlExpression,
    ErrorExpression,
    ErrorScopedAccessExpression,
    ErrorTraitAdaptation,
    ErrorVariable,
    ErrorVariableAtom,
    EvalIntrinsic,
    ExitIntrinsic,
    ExponentiationExpression,
    ExpressionList,
    ExpressionStatement,
    FinallyClause,
    ForControl,
    ForeachCollection,
    ForeachKey,
    ForeachStatement,
    ForeachValue,
    ForEndOfLoop,
    ForExpressionGroup,
    ForInitialiser,
    ForStatement,
    FullyQualifiedName,
    FunctionCallExpression,
    FunctionDeclaration,
    FunctionDeclarationBody,
    FunctionDeclarationHeader,
    FunctionStaticDeclaration,
    FunctionStaticInitialiser,
    GlobalDeclaration,
    GotoStatement,
    HaltCompilerStatement,
    HeredocStringLiteral,
    Identifier,
    IfStatement,
    IncludeExpression,
    IncludeOnceExpression,
    InlineText,
    InstanceOfExpression,
    InstanceofTypeDesignator,
    InterfaceBaseClause,
    InterfaceDeclaration,
    InterfaceDeclarationBody,
    InterfaceDeclarationHeader,
    InterfaceMemberDeclarationList,
    IssetIntrinsic,
    ListIntrinsic,
    LogicalExpression,
    MemberModifierList,
    MemberName,
    MethodCallExpression,
    MethodDeclaration,
    MethodDeclarationBody,
    MethodDeclarationHeader,
    MethodReference,
    MultiplicativeExpression,
    NamedLabelStatement,
    NamespaceAliasingClause,
    NamespaceDefinition,
    NamespaceName,
    NamespaceUseClause,
    NamespaceUseClauseList,
    NamespaceUseDeclaration,
    NamespaceUseGroupClause,
    NamespaceUseGroupClauseList,
    NullStatement,
    ObjectCreationExpression,
    ParameterDeclaration,
    ParameterDeclarationList,
    PostfixDecrementExpression,
    PostfixIncrementExpression,
    PrefixDecrementExpression,
    PrefixIncrementExpression,
    PrintIntrinsic,
    PropertyAccessExpression,
    PropertyDeclaration,
    PropertyElement,
    PropertyElementList,
    PropertyInitialiser,
    QualifiedName,
    QualifiedNameList,
    RelationalExpression,
    RelativeQualifiedName,
    RelativeScope,
    RequireExpression,
    RequireOnceExpression,
    ReturnStatement,
    ReturnType,
    ScopedCallExpression,
    ScopedMemberName,
    ScopedPropertyAccessExpression,
    ShellCommandExpression,
    ShiftExpression,
    SimpleAssignmentExpression,
    SimpleVariable,
    StatementList,
    StaticVariableDeclaration,
    StaticVariableDeclarationList,
    SubscriptExpression,
    SwitchStatement,
    ThrowStatement,
    TraitAdaptationList,
    TraitAlias,
    TraitDeclaration,
    TraitDeclarationBody,
    TraitDeclarationHeader,
    TraitMemberDeclarationList,
    TraitPrecedence,
    TraitUseClause,
    TraitUseSpecification,
    TryStatement,
    TypeDeclaration,
    UnaryOpExpression,
    UnsetIntrinsic,
    VariableList,
    VariableNameList,
    VariadicUnpacking,
    WhileStatement,
    YieldExpression,
    YieldFromExpression
}

export interface Phrase {
    /**
     * Phrase type
     */
    phraseType: PhraseType;
    /**
     * Phrase and token child nodes
     */
    children: (Phrase | Token)[];

}

export interface ParseError extends Phrase {

    /**
    * The token that prompted the parse error
    */
    unexpected: Token;

    /**
     * The expected token type
     */
    expected?: TokenType;

}

export function phraseTypeToString(type: PhraseType) {

    switch (type) {
        case PhraseType.Unknown:
            return 'Unknown';
        case PhraseType.AdditiveExpression:
            return 'AdditiveExpression';
        case PhraseType.AnonymousClassDeclaration:
            return 'AnonymousClassDeclaration';
        case PhraseType.AnonymousClassDeclarationHeader:
            return 'AnonymousClassDeclarationHeader';
        case PhraseType.AnonymousFunctionCreationExpression:
            return 'AnonymousFunctionCreationExpression';
        case PhraseType.AnonymousFunctionHeader:
            return 'AnonymousFunctionHeader';
        case PhraseType.AnonymousFunctionUseClause:
            return 'AnonymousFunctionUseClause';
        case PhraseType.AnonymousFunctionUseVariable:
            return 'AnonymousFunctionUseVariable';
        case PhraseType.ArgumentExpressionList:
            return 'ArgumentExpressionList';
        case PhraseType.ArrayCreationExpression:
            return 'ArrayCreationExpression';
        case PhraseType.ArrayElement:
            return 'ArrayElement';
        case PhraseType.ArrayInitialiserList:
            return 'ArrayInitialiserList';
        case PhraseType.ArrayKey:
            return 'ArrayKey';
        case PhraseType.ArrayValue:
            return 'ArrayValue';
        case PhraseType.BitwiseExpression:
            return 'BitwiseExpression';
        case PhraseType.BreakStatement:
            return 'BreakStatement';
        case PhraseType.ByRefAssignmentExpression:
            return 'ByRefAssignmentExpression';
        case PhraseType.CaseStatement:
            return 'CaseStatement';
        case PhraseType.CaseStatementList:
            return 'CaseStatementList';
        case PhraseType.CastExpression:
            return 'CastExpression';
        case PhraseType.CatchClause:
            return 'CatchClause';
        case PhraseType.CatchClauseList:
            return 'CatchClauseList';
        case PhraseType.CatchNameList:
            return 'CatchNameList';
        case PhraseType.ClassBaseClause:
            return 'ClassBaseClause';
        case PhraseType.ClassConstantAccessExpression:
            return 'ClassConstantAccessExpression';
        case PhraseType.ClassConstDeclaration:
            return 'ClassConstDeclaration';
        case PhraseType.ClassConstElement:
            return 'ClassConstElement';
        case PhraseType.ClassConstElementList:
            return 'ClassConstElementList';
        case PhraseType.ClassDeclaration:
            return 'ClassDeclaration';
        case PhraseType.ClassDeclarationBody:
            return 'ClassDeclarationBody';
        case PhraseType.ClassDeclarationHeader:
            return 'ClassDeclarationHeader';
        case PhraseType.ClassInterfaceClause:
            return 'ClassInterfaceClause';
        case PhraseType.ClassMemberDeclarationList:
            return 'ClassMemberDeclarationList';
        case PhraseType.ClassModifiers:
            return 'ClassModifiers';
        case PhraseType.ClassTypeDesignator:
            return 'ClassTypeDesignator';
        case PhraseType.CloneExpression:
            return 'CloneExpression';
        case PhraseType.ClosureUseList:
            return 'ClosureUseList';
        case PhraseType.CoalesceExpression:
            return 'CoalesceExpression';
        case PhraseType.CompoundAssignmentExpression:
            return 'CompoundAssignmentExpression';
        case PhraseType.CompoundStatement:
            return 'CompoundStatement';
        case PhraseType.TernaryExpression:
            return 'TernaryExpression';
        case PhraseType.ConstantAccessExpression:
            return 'ConstantAccessExpression';
        case PhraseType.ConstDeclaration:
            return 'ConstDeclaration';
        case PhraseType.ConstElement:
            return 'ConstElement';
        case PhraseType.ConstElementList:
            return 'ConstElementList';
        case PhraseType.ContinueStatement:
            return 'ContinueStatement';
        case PhraseType.DeclareDirective:
            return 'DeclareDirective';
        case PhraseType.DeclareStatement:
            return 'DeclareStatement';
        case PhraseType.DefaultStatement:
            return 'DefaultStatement';
        case PhraseType.DoStatement:
            return 'DoStatement';
        case PhraseType.DoubleQuotedStringLiteral:
            return 'DoubleQuotedStringLiteral';
        case PhraseType.EchoIntrinsic:
            return 'EchoIntrinsic';
        case PhraseType.ElseClause:
            return 'ElseClause';
        case PhraseType.ElseIfClause:
            return 'ElseIfClause';
        case PhraseType.ElseIfClauseList:
            return 'ElseIfClauseList';
        case PhraseType.EmptyIntrinsic:
            return 'EmptyIntrinsic';
        case PhraseType.EncapsulatedExpression:
            return 'EncapsulatedExpression';
        case PhraseType.EncapsulatedVariable:
            return 'EncapsulatedVariable';
        case PhraseType.EncapsulatedVariableList:
            return 'EncapsulatedVariableList';
        case PhraseType.EqualityExpression:
            return 'EqualityExpression';
        case PhraseType.Error:
            return 'Error';
        case PhraseType.ErrorClassMemberDeclaration:
            return 'ErrorClassMemberDeclaration';
        case PhraseType.ErrorClassTypeDesignatorAtom:
            return 'ErrorClassTypeDesignatorAtom';
        case PhraseType.ErrorControlExpression:
            return 'ErrorControlExpression';
        case PhraseType.ErrorExpression:
            return 'ErrorExpression';
        case PhraseType.ErrorScopedAccessExpression:
            return 'ErrorScopedAccessExpression';
        case PhraseType.ErrorTraitAdaptation:
            return 'ErrorTraitAdaptation';
        case PhraseType.ErrorVariable:
            return 'ErrorVariable';
        case PhraseType.ErrorVariableAtom:
            return 'ErrorVariableAtom';
        case PhraseType.EvalIntrinsic:
            return 'EvalIntrinsic';
        case PhraseType.ExitIntrinsic:
            return 'ExitIntrinsic';
        case PhraseType.ExponentiationExpression:
            return 'ExponentiationExpression';
        case PhraseType.ExpressionList:
            return 'ExpressionList';
        case PhraseType.ExpressionStatement:
            return 'ExpressionStatement';
        case PhraseType.FinallyClause:
            return 'FinallyClause';
        case PhraseType.ForControl:
            return 'ForControl';
        case PhraseType.ForeachCollection:
            return 'ForeachCollection';
        case PhraseType.ForeachKey:
            return 'ForeachKey';
        case PhraseType.ForeachStatement:
            return 'ForeachStatement';
        case PhraseType.ForeachValue:
            return 'ForeachValue';
        case PhraseType.ForEndOfLoop:
            return 'ForEndOfLoop';
        case PhraseType.ForExpressionGroup:
            return 'ForExpressionGroup';
        case PhraseType.ForInitialiser:
            return 'ForInitialiser';
        case PhraseType.ForStatement:
            return 'ForStatement';
        case PhraseType.FullyQualifiedName:
            return 'FullyQualifiedName';
        case PhraseType.FunctionCallExpression:
            return 'FunctionCallExpression';
        case PhraseType.FunctionDeclaration:
            return 'FunctionDeclaration';
        case PhraseType.FunctionDeclarationHeader:
            return 'FunctionDeclarationHeader';
        case PhraseType.FunctionDeclarationBody:
            return 'FunctionDeclarationBody';
        case PhraseType.FunctionStaticDeclaration:
            return 'FunctionStaticDeclaration';
        case PhraseType.FunctionStaticInitialiser:
            return 'FunctionStaticInitialiser';
        case PhraseType.GlobalDeclaration:
            return 'GlobalDeclaration';
        case PhraseType.GotoStatement:
            return 'GotoStatement';
        case PhraseType.HaltCompilerStatement:
            return 'HaltCompilerStatement';
        case PhraseType.HeredocStringLiteral:
            return 'HeredocStringLiteral';
        case PhraseType.Identifier:
            return 'Identifier';
        case PhraseType.IfStatement:
            return 'IfStatement';
        case PhraseType.IncludeExpression:
            return 'IncludeExpression';
        case PhraseType.IncludeOnceExpression:
            return 'IncludeOnceExpression';
        case PhraseType.InlineText:
            return 'InlineText';
        case PhraseType.InstanceOfExpression:
            return 'InstanceOfExpression';
        case PhraseType.InstanceofTypeDesignator:
            return 'InstanceofTypeDesignator';
        case PhraseType.InterfaceBaseClause:
            return 'InterfaceBaseClause';
        case PhraseType.InterfaceDeclaration:
            return 'InterfaceDeclaration';
        case PhraseType.InterfaceDeclarationBody:
            return 'InterfaceDeclarationBody';
        case PhraseType.InterfaceDeclarationHeader:
            return 'InterfaceDeclarationHeader';
        case PhraseType.InterfaceMemberDeclarationList:
            return 'InterfaceMemberDeclarationList';
        case PhraseType.IssetIntrinsic:
            return 'IssetIntrinsic';
        case PhraseType.ListIntrinsic:
            return 'ListIntrinsic';
        case PhraseType.LogicalExpression:
            return 'LogicalExpression';
        case PhraseType.MemberModifierList:
            return 'MemberModifierList';
        case PhraseType.MemberName:
            return 'MemberName';
        case PhraseType.MethodCallExpression:
            return 'MethodCallExpression';
        case PhraseType.MethodDeclaration:
            return 'MethodDeclaration';
        case PhraseType.MethodDeclarationBody:
            return 'MethodDeclarationBody';
        case PhraseType.MethodDeclarationHeader:
            return 'MethodDeclarationHeader';
        case PhraseType.MethodReference:
            return 'MethodReference';
        case PhraseType.MultiplicativeExpression:
            return 'MultiplicativeExpression';
        case PhraseType.NamedLabelStatement:
            return 'NamedLabelStatement';
        case PhraseType.NamespaceAliasingClause:
            return 'NamespaceAliasingClause';
        case PhraseType.NamespaceDefinition:
            return 'NamespaceDefinition';
        case PhraseType.NamespaceName:
            return 'NamespaceName';
        case PhraseType.NamespaceUseClause:
            return 'NamespaceUseClause';
        case PhraseType.NamespaceUseClauseList:
            return 'NamespaceUseClauseList';
        case PhraseType.NamespaceUseDeclaration:
            return 'NamespaceUseDeclaration';
        case PhraseType.NamespaceUseGroupClause:
            return 'NamespaceUseGroupClause';
        case PhraseType.NamespaceUseGroupClauseList:
            return 'NamespaceUseGroupClauseList';
        case PhraseType.NullStatement:
            return 'NullStatement';
        case PhraseType.ObjectCreationExpression:
            return 'ObjectCreationExpression';
        case PhraseType.ParameterDeclaration:
            return 'ParameterDeclaration';
        case PhraseType.ParameterDeclarationList:
            return 'ParameterDeclarationList';
        case PhraseType.PostfixDecrementExpression:
            return 'PostfixDecrementExpression';
        case PhraseType.PostfixIncrementExpression:
            return 'PostfixIncrementExpression';
        case PhraseType.PrefixDecrementExpression:
            return 'PrefixDecrementExpression';
        case PhraseType.PrefixIncrementExpression:
            return 'PrefixIncrementExpression';
        case PhraseType.PrintIntrinsic:
            return 'PrintIntrinsic';
        case PhraseType.PropertyAccessExpression:
            return 'PropertyAccessExpression';
        case PhraseType.PropertyDeclaration:
            return 'PropertyDeclaration';
        case PhraseType.PropertyElement:
            return 'PropertyElement';
        case PhraseType.PropertyElementList:
            return 'PropertyElementList';
        case PhraseType.PropertyInitialiser:
            return 'PropertyInitialiser';
        case PhraseType.QualifiedName:
            return 'QualifiedName';
        case PhraseType.QualifiedNameList:
            return 'QualifiedNameList';
        case PhraseType.RelationalExpression:
            return 'RelationalExpression';
        case PhraseType.RelativeQualifiedName:
            return 'RelativeQualifiedName';
        case PhraseType.RelativeScope:
            return 'RelativeScope';
        case PhraseType.RequireExpression:
            return 'RequireExpression';
        case PhraseType.RequireOnceExpression:
            return 'RequireOnceExpression';
        case PhraseType.ReturnStatement:
            return 'ReturnStatement';
        case PhraseType.ReturnType:
            return 'ReturnType';
        case PhraseType.ScopedCallExpression:
            return 'ScopedCallExpression';
        case PhraseType.ScopedMemberName:
            return 'ScopedMemberName';
        case PhraseType.ScopedPropertyAccessExpression:
            return 'ScopedPropertyAccessExpression';
        case PhraseType.ShellCommandExpression:
            return 'ShellCommandExpression';
        case PhraseType.ShiftExpression:
            return 'ShiftExpression';
        case PhraseType.SimpleAssignmentExpression:
            return 'SimpleAssignmentExpression';
        case PhraseType.SimpleVariable:
            return 'SimpleVariable';
        case PhraseType.StatementList:
            return 'StatementList';
        case PhraseType.StaticVariableDeclaration:
            return 'StaticVariableDeclaration';
        case PhraseType.StaticVariableDeclarationList:
            return 'StaticVariableDeclarationList';
        case PhraseType.SubscriptExpression:
            return 'SubscriptExpression';
        case PhraseType.SwitchStatement:
            return 'SwitchStatement';
        case PhraseType.ThrowStatement:
            return 'ThrowStatement';
        case PhraseType.TraitAdaptationList:
            return 'TraitAdaptationList';
        case PhraseType.TraitAlias:
            return 'TraitAlias';
        case PhraseType.TraitDeclaration:
            return 'TraitDeclaration';
        case PhraseType.TraitDeclarationBody:
            return 'TraitDeclarationBody';
        case PhraseType.TraitDeclarationHeader:
            return 'TraitDeclarationHeader';
        case PhraseType.TraitMemberDeclarationList:
            return 'TraitMemberDeclarationList';
        case PhraseType.TraitPrecedence:
            return 'TraitPrecedence';
        case PhraseType.TraitUseClause:
            return 'TraitUseClause';
        case PhraseType.TraitUseSpecification:
            return 'TraitUseSpecification';
        case PhraseType.TryStatement:
            return 'TryStatement';
        case PhraseType.TypeDeclaration:
            return 'TypeDeclaration';
        case PhraseType.UnaryOpExpression:
            return 'UnaryOpExpression';
        case PhraseType.UnsetIntrinsic:
            return 'UnsetIntrinsic';
        case PhraseType.VariableList:
            return 'VariableList';
        case PhraseType.VariableNameList:
            return 'VariableNameList';
        case PhraseType.VariadicUnpacking:
            return 'VariadicUnpacking';
        case PhraseType.WhileStatement:
            return 'WhileStatement';
        case PhraseType.YieldExpression:
            return 'YieldExpression';
        case PhraseType.YieldFromExpression:
            return 'YieldFromExpression';
        default:
            return '';
    }
}
