"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var ts = require('typescript');
var base = require('./base');
var ExpressionTranspiler = (function (_super) {
    __extends(ExpressionTranspiler, _super);
    function ExpressionTranspiler(tr, fc) {
        _super.call(this, tr);
        this.fc = fc;
    }
    ExpressionTranspiler.prototype.visitNode = function (node) {
        switch (node.kind) {
            case ts.SyntaxKind.BinaryExpression:
                var binExpr = node;
                var operatorKind = binExpr.operatorToken.kind;
                var tokenStr = ts.tokenToString(operatorKind);
                switch (operatorKind) {
                    case ts.SyntaxKind.EqualsEqualsEqualsToken:
                    case ts.SyntaxKind.ExclamationEqualsEqualsToken:
                        // this.emit('identical (');
                        this.visit(binExpr.left);
                        if (operatorKind === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
                            this.emit('!=');
                        }
                        else {
                            this.emit('==');
                        }
                        this.visit(binExpr.right);
                        // this.emit(')');
                        break;
                    case ts.SyntaxKind.CaretToken:
                    case ts.SyntaxKind.BarToken:
                    case ts.SyntaxKind.AmpersandToken:
                    case ts.SyntaxKind.GreaterThanGreaterThanToken:
                    case ts.SyntaxKind.LessThanLessThanToken:
                    case ts.SyntaxKind.CaretEqualsToken:
                    case ts.SyntaxKind.BarEqualsToken:
                    case ts.SyntaxKind.AmpersandEqualsToken:
                    case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
                    case ts.SyntaxKind.LessThanLessThanEqualsToken:
                        // In Dart, the bitwise operators are only available on int, so the number types ts2dart
                        // deals with have to be converted to int explicitly to match JS's semantics in Dart.
                        if (tokenStr[tokenStr.length - 1] === '=') {
                            // For assignments, strip the trailing `=` sign to emit just the operator itself.
                            this.visit(binExpr.left);
                            this.emit('=');
                            this.visitAndWrapAsInt(binExpr.left);
                            this.emit(tokenStr.slice(0, -1));
                        }
                        else {
                            // normal case (LHS [op])
                            this.visitAndWrapAsInt(binExpr.left);
                            this.emit(tokenStr);
                        }
                        this.visitAndWrapAsInt(binExpr.right);
                        break;
                    case ts.SyntaxKind.InKeyword:
                        this.reportError(node, 'in operator is unsupported');
                        break;
                    case ts.SyntaxKind.InstanceOfKeyword:
                        this.visit(binExpr.left);
                        this.emit('is');
                        this.fc.visitTypeName(binExpr.right);
                        break;
                    default:
                        this.visit(binExpr.left);
                        this.emit(tokenStr);
                        this.visit(binExpr.right);
                        break;
                }
                break;
            case ts.SyntaxKind.PrefixUnaryExpression:
                var prefixUnary = node;
                var operator = ts.tokenToString(prefixUnary.operator);
                this.emit(operator);
                if (prefixUnary.operator === ts.SyntaxKind.TildeToken) {
                    this.visitAndWrapAsInt(prefixUnary.operand);
                }
                else {
                    this.visit(prefixUnary.operand);
                }
                break;
            case ts.SyntaxKind.PostfixUnaryExpression:
                var postfixUnary = node;
                this.visit(postfixUnary.operand);
                this.emit(ts.tokenToString(postfixUnary.operator));
                break;
            case ts.SyntaxKind.ConditionalExpression:
                var conditional = node;
                this.visit(conditional.condition);
                this.emit('?');
                this.visit(conditional.whenTrue);
                this.emit(':');
                this.visit(conditional.whenFalse);
                break;
            case ts.SyntaxKind.DeleteExpression:
                this.emit('/*delete*/');
                // this.reportError(node, 'delete operator is unsupported');
                break;
            case ts.SyntaxKind.VoidExpression:
                this.emit('/*void*/');
                // this.reportError(node, 'void operator is unsupported');
                break;
            case ts.SyntaxKind.TypeOfExpression:
                this.emit('/*typeof*/');
                this.visit(node.expression);
                // this.reportError(node, 'typeof operator is unsupported');
                break;
            case ts.SyntaxKind.ParenthesizedExpression:
                var parenExpr = node;
                this.emit('(');
                this.visit(parenExpr.expression);
                this.emit(')');
                break;
            case ts.SyntaxKind.PropertyAccessExpression:
                var propAccess = node;
                if (propAccess.name.text === 'stack' &&
                    this.hasAncestor(propAccess, ts.SyntaxKind.CatchClause)) {
                    // Handle `e.stack` accesses in catch clauses by mangling to `e_stack`.
                    // FIXME: Use type checker/FacadeConverter to make sure this is actually Error.stack.
                    this.visit(propAccess.expression);
                    this.emitNoSpace('_stack');
                }
                else {
                    if (this.fc.handlePropertyAccess(propAccess))
                        break;
                    this.visit(propAccess.expression);
                    this.emit('.');
                    this.visit(propAccess.name);
                }
                break;
            case ts.SyntaxKind.ElementAccessExpression:
                var elemAccess = node;
                this.visit(elemAccess.expression);
                this.emit('[');
                this.visit(elemAccess.argumentExpression);
                this.emit(']');
                break;
            default:
                return false;
        }
        return true;
    };
    ExpressionTranspiler.prototype.visitAndWrapAsInt = function (n) {
        var lhsIsHexLit = n.kind === ts.SyntaxKind.NumericLiteral;
        if (lhsIsHexLit) {
            this.visit(n);
            return;
        }
        this.emit('(');
        this.visit(n);
        this.emit('as int)');
    };
    return ExpressionTranspiler;
}(base.TranspilerBase));
exports.__esModule = true;
exports["default"] = ExpressionTranspiler;

//# sourceMappingURL=expression.js.map
