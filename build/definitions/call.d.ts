import ts = require('typescript');
import base = require('./base');
import ts2dart = require('./main');
import { FacadeConverter } from './facade_converter';
export default class CallTranspiler extends base.TranspilerBase {
    private fc;
    constructor(tr: ts2dart.Transpiler, fc: FacadeConverter);
    visitNode(node: ts.Node): boolean;
    private visitCall(c);
    private handleNamedParamsCall(c);
    /**
     * Handles constructor initializer lists and bodies.
     *
     * <p>Dart's super() ctor calls have to be moved to the constructors initializer list, and `const`
     * constructors must be completely empty, only assigning into fields through the initializer list.
     * The code below finds super() calls and handles const constructors, marked with the special
     * `@CONST` annotation on the class.
     *
     * <p>Not emitting super() calls when traversing the ctor body is handled by maybeHandleSuperCall
     * below.
     */
    private visitConstructorBody(ctor);
    /**
     * Checks whether `callExpr` is a super() call that should be ignored because it was already
     * handled by `maybeEmitSuperInitializer` above.
     */
    private maybeHandleSuperCall(callExpr);
}
