"use strict";
var ts = require('typescript');
function ident(n) {
    if (n.kind === ts.SyntaxKind.Identifier)
        return n.text;
    if (n.kind === ts.SyntaxKind.QualifiedName) {
        var qname = n;
        var leftName = ident(qname.left);
        if (leftName)
            return leftName + '.' + ident(qname.right);
    }
    return null;
}
exports.ident = ident;
var TranspilerBase = (function () {
    function TranspilerBase(transpiler) {
        this.transpiler = transpiler;
        this.idCounter = 0;
    }
    TranspilerBase.prototype.visit = function (n) { this.transpiler.visit(n); };
    TranspilerBase.prototype.emit = function (s) { this.transpiler.emit(s); };
    TranspilerBase.prototype.emitBefore = function (s, search) { this.transpiler.emitBefore(s, search); };
    TranspilerBase.prototype.emitNoSpace = function (s) { this.transpiler.emitNoSpace(s); };
    TranspilerBase.prototype.reportError = function (n, message) { this.transpiler.reportError(n, message); };
    TranspilerBase.prototype.visitNode = function (n) { throw new Error('not implemented'); };
    TranspilerBase.prototype.visitEach = function (nodes) {
        var _this = this;
        nodes.forEach(function (n) { return _this.visit(n); });
    };
    TranspilerBase.prototype.visitEachIfPresent = function (nodes) {
        if (nodes)
            this.visitEach(nodes);
    };
    TranspilerBase.prototype.visitList = function (nodes, separator) {
        if (separator === void 0) { separator = ','; }
        for (var i = 0; i < nodes.length; i++) {
            this.visit(nodes[i]);
            if (i < nodes.length - 1)
                this.emit(separator);
        }
    };
    TranspilerBase.prototype.uniqueId = function (name) {
        var id = this.idCounter++;
        return "_" + name + "$$ts2dart$" + id;
    };
    TranspilerBase.prototype.assert = function (c, condition, reason) {
        if (!condition) {
            this.reportError(c, reason);
            throw new Error(reason);
        }
    };
    TranspilerBase.prototype.getAncestor = function (n, kind) {
        for (var parent_1 = n; parent_1; parent_1 = parent_1.parent) {
            if (parent_1.kind === kind)
                return parent_1;
        }
        return null;
    };
    TranspilerBase.prototype.hasAncestor = function (n, kind) { return !!this.getAncestor(n, kind); };
    TranspilerBase.prototype.hasAnnotation = function (decorators, name) {
        if (!decorators)
            return false;
        return decorators.some(function (d) {
            var decName = ident(d.expression);
            if (decName === name)
                return true;
            if (d.expression.kind !== ts.SyntaxKind.CallExpression)
                return false;
            var callExpr = d.expression;
            decName = ident(callExpr.expression);
            return decName === name;
        });
    };
    TranspilerBase.prototype.hasFlag = function (n, flag) {
        return n && (n.flags & flag) !== 0 || false;
    };
    TranspilerBase.prototype.maybeDestructureIndexType = function (node) {
        var members = node.members;
        if (members.length !== 1 || members[0].kind !== ts.SyntaxKind.IndexSignature) {
            return null;
        }
        var indexSig = (members[0]);
        if (indexSig.parameters.length > 1) {
            this.reportError(indexSig, 'Expected an index signature to have a single parameter');
        }
        return [indexSig.parameters[0].type, indexSig.type];
    };
    TranspilerBase.prototype.getRelativeFileName = function (fileName) {
        return this.transpiler.getRelativeFileName(fileName);
    };
    TranspilerBase.prototype.maybeVisitTypeArguments = function (n) {
        if (n.typeArguments) {
            // If it's a single type argument `<void>`, ignore it and emit nothing.
            // This is particularly useful for `Promise<void>`, see
            // https://github.com/dart-lang/sdk/issues/2231#issuecomment-108313639
            if (n.typeArguments.length === 1 && n.typeArguments[0].kind === ts.SyntaxKind.VoidKeyword) {
                return;
            }
            this.emitNoSpace('<');
            this.visitList(n.typeArguments);
            this.emit('>');
        }
    };
    return TranspilerBase;
}());
exports.TranspilerBase = TranspilerBase;

//# sourceMappingURL=base.js.map
