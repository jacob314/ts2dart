import * as ts from 'typescript';
import * as base from './base';
import { FacadeConverter } from './facade_converter';
import { Transpiler } from './main';
export default class ModuleTranspiler extends base.TranspilerBase {
    private fc;
    private generateLibraryName;
    constructor(tr: Transpiler, fc: FacadeConverter, generateLibraryName: boolean);
    visitNode(node: ts.Node): boolean;
    private static isIgnoredImport(e);
    private visitExternalModuleReferenceExpr(expr);
    private isEmptyImport(n);
    private filterImports(ns);
    private static DART_RESERVED_WORDS;
    getLibraryName(fileName: string): string;
}
