import * as ts from 'typescript';
import * as base from './base';
import { Transpiler } from './main';
export declare class FacadeConverter extends base.TranspilerBase {
    private tc;
    private defaultLibLocation;
    private candidateProperties;
    private candidateTypes;
    private genericMethodDeclDepth;
    constructor(transpiler: Transpiler);
    initializeTypeBasedConversion(tc: ts.TypeChecker, opts: ts.CompilerOptions, host: ts.CompilerHost): void;
    private extractPropertyNames(m, candidates);
    private resolveModuleNames(opts, host, m);
    /**
     * To avoid strongly referencing the Provider class (which could bloat binary size), Angular 2
     * write providers as object literals. However the Dart transformers don't recognize this, so
     * ts2dart translates the special syntax `/* @ts2dart_Provider * / {provide: Class, param1: ...}`
     * into `const Provider(Class, param1: ...)`.
     */
    maybeHandleProvider(ole: ts.ObjectLiteralExpression): boolean;
    maybeHandleCall(c: ts.CallExpression): boolean;
    handlePropertyAccess(pa: ts.PropertyAccessExpression): boolean;
    /**
     * Searches for type references that require extra imports and emits the imports as necessary.
     */
    emitExtraImports(sourceFile: ts.SourceFile): void;
    private emitImports(n, libraries, emitted, sourceFile);
    pushTypeParameterNames(n: ts.FunctionLikeDeclaration): void;
    popTypeParameterNames(n: ts.FunctionLikeDeclaration): void;
    resolvePropertyTypes(tn: ts.TypeNode): ts.Map<ts.PropertyDeclaration>;
    /**
     * The Dart Development Compiler (DDC) has a syntax extension that uses comments to emulate
     * generic methods in Dart. ts2dart has to hack around this and keep track of which type names
     * in the current scope are actually DDC type parameters and need to be emitted in comments.
     *
     * TODO(martinprobst): Remove this once the DDC hack has made it into Dart proper.
     */
    private isGenericMethodTypeParameterName(name);
    visitTypeName(typeName: ts.EntityName): void;
    shouldEmitNew(c: ts.CallExpression): boolean;
    private getCallInformation(c);
    private getHandler<T>(n, symbol, m);
    private getFileAndName(n, originalSymbol);
    private isNamedDefaultLibType(node, qname);
    private reportMissingType(n, ident);
    private static DECLARATIONS;
    isInsideConstExpr(node: ts.Node): boolean;
    isConstClass(decl: base.ClassLike): boolean;
    /**
     * isConstExpr returns true if the passed in expression itself is a const expression. const
     * expressions are marked by the special comment @ts2dart_const (expr), or by the special
     * function call CONST_EXPR.
     */
    isConstExpr(node: ts.Node): boolean;
    hasConstComment(node: ts.Node): boolean;
    private hasMarkerComment(node, markerText);
    private emitMethodCall(name, args?);
    private emitCall(name, args?);
    private stdlibTypeReplacements;
    private tsToDartTypeNames;
    private es6Promises;
    private es6Collections;
    private stdlibHandlers;
    private callHandlerReplaceNew;
    private callHandlers;
    private es6CollectionsProp;
    private es6PromisesProp;
    private propertyHandlers;
}
