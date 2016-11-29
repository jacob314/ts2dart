import * as ts from 'typescript';
import * as base from './base';
import { Transpiler } from './main';
export default class StatementTranspiler extends base.TranspilerBase {
    constructor(tr: Transpiler);
    visitNode(node: ts.Node): boolean;
}
