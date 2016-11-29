"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var ts = require('typescript');
var base = require('./base');
var TypeTranspiler = (function (_super) {
    __extends(TypeTranspiler, _super);
    function TypeTranspiler(tr, fc) {
        _super.call(this, tr);
        this.fc = fc;
    }
    TypeTranspiler.prototype.visitNode = function (node) {
        switch (node.kind) {
            case ts.SyntaxKind.TypeLiteral:
                var indexType = this.maybeDestructureIndexType(node);
                if (indexType) {
                    // This is effectively a Map.
                    this.emit('Map <');
                    this.visit(indexType[0]);
                    this.emit(',');
                    this.visit(indexType[1]);
                    this.emit('>');
                }
                else {
                    // Dart doesn't support other type literals.
                    this.emit('dynamic');
                }
                break;
            case ts.SyntaxKind.UnionType:
                this.emit('dynamic /*');
                this.visitList(node.types, '|');
                this.emit('*/');
                break;
            case ts.SyntaxKind.TypeReference:
                var typeRef = node;
                this.fc.visitTypeName(typeRef.typeName);
                this.maybeVisitTypeArguments(typeRef);
                break;
            case ts.SyntaxKind.TypeAssertionExpression:
                var typeAssertExpr = node;
                if (this.isReifiedTypeLiteral(typeAssertExpr)) {
                    this.visit(typeAssertExpr.expression);
                    break; // type is handled by the container literal itself.
                }
                this.emit('(');
                this.visit(typeAssertExpr.expression);
                this.emit('as');
                this.visit(typeAssertExpr.type);
                this.emit(')');
                break;
            case ts.SyntaxKind.TypeParameter:
                var typeParam = node;
                this.visit(typeParam.name);
                if (typeParam.constraint) {
                    this.emit('extends');
                    this.visit(typeParam.constraint);
                }
                break;
            case ts.SyntaxKind.ArrayType:
                this.emit('List');
                this.emit('<');
                this.visit(node.elementType);
                this.emit('>');
                break;
            case ts.SyntaxKind.FunctionType:
                this.emit('dynamic /*');
                this.emit(node.getText());
                this.emit('*/');
                break;
            case ts.SyntaxKind.QualifiedName:
                var first = node;
                this.visit(first.left);
                this.emit('.');
                this.visit(first.right);
                break;
            case ts.SyntaxKind.Identifier:
                var ident = node;
                this.fc.visitTypeName(ident);
                break;
            case ts.SyntaxKind.NumberKeyword:
                this.emit('num');
                break;
            case ts.SyntaxKind.StringKeyword:
                this.emit('String');
                break;
            case ts.SyntaxKind.VoidKeyword:
                this.emit('void');
                break;
            case ts.SyntaxKind.BooleanKeyword:
                this.emit('bool');
                break;
            case ts.SyntaxKind.AnyKeyword:
                this.emit('dynamic');
                break;
            default:
                return false;
        }
        return true;
    };
    TypeTranspiler.prototype.isReifiedTypeLiteral = function (node) {
        if (node.expression.kind === ts.SyntaxKind.ArrayLiteralExpression &&
            node.type.kind === ts.SyntaxKind.ArrayType) {
            return true;
        }
        else if (node.expression.kind === ts.SyntaxKind.ObjectLiteralExpression &&
            node.type.kind === ts.SyntaxKind.TypeLiteral) {
            return true;
        }
        return false;
    };
    return TypeTranspiler;
}(base.TranspilerBase));
exports.__esModule = true;
exports["default"] = TypeTranspiler;

//# sourceMappingURL=type.js.map
