import * as ts from 'typescript';
import { Transpiler } from './main';
export declare type ClassLike = ts.ClassDeclaration | ts.InterfaceDeclaration;
export declare function ident(n: ts.Node): string;
export declare class TranspilerBase {
    private transpiler;
    private idCounter;
    constructor(transpiler: Transpiler);
    visit(n: ts.Node): void;
    emit(s: string): void;
    emitBefore(s: string, search: string): void;
    emitNoSpace(s: string): void;
    reportError(n: ts.Node, message: string): void;
    visitNode(n: ts.Node): boolean;
    visitEach(nodes: ts.Node[]): void;
    visitEachIfPresent(nodes?: ts.Node[]): void;
    visitList(nodes: ts.Node[], separator?: string): void;
    uniqueId(name: string): string;
    assert(c: ts.Node, condition: boolean, reason: string): void;
    getAncestor(n: ts.Node, kind: ts.SyntaxKind): ts.Node;
    hasAncestor(n: ts.Node, kind: ts.SyntaxKind): boolean;
    hasAnnotation(decorators: ts.NodeArray<ts.Decorator>, name: string): boolean;
    hasFlag(n: {
        flags: number;
    }, flag: ts.NodeFlags): boolean;
    maybeDestructureIndexType(node: ts.TypeLiteralNode): [ts.TypeNode, ts.TypeNode];
    getRelativeFileName(fileName: string): string;
    maybeVisitTypeArguments(n: {
        typeArguments?: ts.NodeArray<ts.TypeNode>;
    }): void;
}
