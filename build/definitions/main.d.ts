import * as ts from 'typescript';
export interface TranspilerOptions {
    /**
     * Fail on the first error, do not collect multiple. Allows easier debugging as stack traces lead
     * directly to the offending line.
     */
    failFast?: boolean;
    /** Whether to generate 'library a.b.c;' names from relative file paths. */
    generateLibraryName?: boolean;
    /** Whether to generate source maps. */
    generateSourceMap?: boolean;
    /** A tsconfig.json to use to configure TypeScript compilation. */
    tsconfig?: string;
    /**
     * A base path to relativize absolute file paths against. This is useful for library name
     * generation (see above) and nicer file names in error messages.
     */
    basePath?: string;
    /**
     * Translate calls to builtins, i.e. seemlessly convert from `Array` to `List`, and convert the
     * corresponding methods. Requires type checking.
     */
    translateBuiltins?: boolean;
    /**
     * Enforce conventions of public/private keyword and underscore prefix
     */
    enforceUnderscoreConventions?: boolean;
}
export declare const COMPILER_OPTIONS: ts.CompilerOptions;
export declare class Transpiler {
    private options;
    private output;
    private currentFile;
    private lastCommentIdx;
    private errors;
    private transpilers;
    private fc;
    constructor(options?: TranspilerOptions);
    /**
     * Transpiles the given files to Dart.
     * @param fileNames The input files.
     * @param destination Location to write files to. Creates files next to their sources if absent.
     */
    transpile(fileNames: string[], destination?: string): void;
    translateProgram(program: ts.Program, host: ts.CompilerHost): {
        [path: string]: string;
    };
    private getCompilerOptions();
    private createCompilerHost();
    getOutputPath(filePath: string, destinationRoot: string): string;
    private translate(sourceFile);
    private formatCode(code, context);
    private checkForErrors(program);
    private diagnosticToString(diagnostic);
    /**
     * Returns `filePath`, relativized to the program's `basePath`.
     * @param filePath path to relativize.
     */
    getRelativeFileName(filePath: string): string;
    emit(s: string): void;
    emitBefore(s: string, search: string): void;
    emitNoSpace(s: string): void;
    reportError(n: ts.Node, message: string): void;
    visit(node: ts.Node): void;
    private normalizeSlashes(path);
    private translateComment(comment);
}
export declare function getModuleResolver(compilerHost: ts.CompilerHost): (moduleNames: string[], containingFile: string) => ts.ResolvedModule[];
