import * as ts from 'typescript';
import * as base from './base';
import { FacadeConverter } from './facade_converter';
import { Transpiler } from './main';
export default class ExpressionTranspiler extends base.TranspilerBase {
    private fc;
    constructor(tr: Transpiler, fc: FacadeConverter);
    visitNode(node: ts.Node): boolean;
    visitAndWrapAsInt(n: ts.Expression): void;
}
