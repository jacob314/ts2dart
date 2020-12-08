import * as ts from 'typescript';
import * as base from './base';
import { FacadeConverter } from './facade_converter';
import { Transpiler } from './main';
export default class DeclarationTranspiler extends base.TranspilerBase {
    private fc;
    private enforceUnderscoreConventions;
    constructor(tr: Transpiler, fc: FacadeConverter, enforceUnderscoreConventions: boolean);
    visitNode(node: ts.Node): boolean;
    private visitVariableDeclarationType(varDecl);
    private visitFunctionLike(fn, accessor?);
    private visitParameters(parameters);
    /**
     * Visit a property declaration.
     * In the special case of property parameters in a constructor, we also allow a parameter to be
     * emitted as a property.
     */
    private visitProperty(decl, isParameter?);
    private visitClassLike(keyword, decl);
    private visitDecorators(decorators);
    private visitDeclarationMetadata(decl);
    private visitNamedParameter(paramDecl);
    private getInitializers(paramDecl);
    /**
     * Handles a function typedef-like interface, i.e. an interface that only declares a single
     * call signature, by translating to a Dart `typedef`.
     */
    private visitFunctionTypedefInterface(name, signature, typeParameters);
}
