"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var ts = require('typescript');
var base = require('./base');
var LiteralTranspiler = (function (_super) {
    __extends(LiteralTranspiler, _super);
    function LiteralTranspiler(tr, fc) {
        _super.call(this, tr);
        this.fc = fc;
    }
    LiteralTranspiler.prototype.visitNode = function (node) {
        switch (node.kind) {
            // Literals.
            case ts.SyntaxKind.NumericLiteral:
                var nLit = node;
                this.emit(nLit.getText());
                break;
            case ts.SyntaxKind.StringLiteral:
                var sLit = node;
                var text = JSON.stringify(sLit.text);
                // Escape dollar sign since dart will interpolate in double quoted literal
                text = text.replace(/\$/, '\\$');
                this.emit(text);
                break;
            case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
                this.emit("'''" + this.escapeTextForTemplateString(node) + "'''");
                break;
            case ts.SyntaxKind.TemplateMiddle:
                this.emitNoSpace(this.escapeTextForTemplateString(node));
                break;
            case ts.SyntaxKind.TemplateExpression:
                var tmpl = node;
                if (tmpl.head)
                    this.visit(tmpl.head);
                if (tmpl.templateSpans)
                    this.visitEach(tmpl.templateSpans);
                break;
            case ts.SyntaxKind.TemplateHead:
                this.emit("'''" + this.escapeTextForTemplateString(node)); // highlighting bug:'
                break;
            case ts.SyntaxKind.TemplateTail:
                this.emitNoSpace(this.escapeTextForTemplateString(node));
                this.emitNoSpace("'''");
                break;
            case ts.SyntaxKind.TemplateSpan:
                var span = node;
                if (span.expression) {
                    // Do not emit extra whitespace inside the string template
                    this.emitNoSpace('${');
                    this.visit(span.expression);
                    this.emitNoSpace('}');
                }
                if (span.literal)
                    this.visit(span.literal);
                break;
            case ts.SyntaxKind.ArrayLiteralExpression:
                if (this.shouldBeConst(node))
                    this.emit('const');
                var ale = node;
                this.handleReifiedArray(ale);
                this.emit('[');
                this.visitList(ale.elements);
                this.emit(']');
                break;
            case ts.SyntaxKind.ObjectLiteralExpression:
                var ole = node;
                if (this.fc.maybeHandleProvider(ole))
                    return true;
                if (this.shouldBeConst(node))
                    this.emit('const');
                this.handleReifiedMap(ole);
                this.emit('{');
                this.visitList(ole.properties);
                this.emit('}');
                break;
            case ts.SyntaxKind.PropertyAssignment:
                var propAssign = node;
                if (propAssign.name.kind === ts.SyntaxKind.Identifier) {
                    // Dart identifiers in Map literals need quoting.
                    this.emitNoSpace(' \'');
                    this.emitNoSpace(propAssign.name.text);
                    this.emitNoSpace('\'');
                }
                else {
                    this.visit(propAssign.name);
                }
                this.emit(':');
                this.visit(propAssign.initializer);
                break;
            case ts.SyntaxKind.ShorthandPropertyAssignment:
                var shorthand = node;
                this.emitNoSpace(' \'');
                this.emitNoSpace(shorthand.name.text);
                this.emitNoSpace('\'');
                this.emit(':');
                this.visit(shorthand.name);
                break;
            case ts.SyntaxKind.TrueKeyword:
                this.emit('true');
                break;
            case ts.SyntaxKind.FalseKeyword:
                this.emit('false');
                break;
            case ts.SyntaxKind.NullKeyword:
                this.emit('null');
                break;
            case ts.SyntaxKind.RegularExpressionLiteral:
                this.emit('new RegExp (');
                this.emit('r\'');
                var regExp = node.text;
                var slashIdx = regExp.lastIndexOf('/');
                var flags = regExp.substring(slashIdx + 1);
                regExp = regExp.substring(1, slashIdx); // cut off /.../ chars.
                regExp = regExp.replace(/'/g, '\' + "\'" + r\''); // handle nested quotes by concatenation.
                this.emitNoSpace(regExp);
                this.emitNoSpace('\'');
                if (flags.indexOf('g') === -1) {
                    // Dart RegExps are always global, so JS regexps must use 'g' so that semantics match.
                    this.reportError(node, 'Regular Expressions must use the //g flag');
                }
                if (flags.indexOf('m') !== -1) {
                    this.emit(', multiLine: true');
                }
                if (flags.indexOf('i') !== -1) {
                    this.emit(', caseSensitive: false');
                }
                this.emit(')');
                break;
            case ts.SyntaxKind.ThisKeyword:
                this.emit('this');
                break;
            default:
                return false;
        }
        return true;
    };
    LiteralTranspiler.prototype.shouldBeConst = function (n) {
        return this.hasAncestor(n, ts.SyntaxKind.Decorator) || this.fc.isInsideConstExpr(n);
    };
    LiteralTranspiler.prototype.escapeTextForTemplateString = function (n) {
        return n.text.replace(/\\/g, '\\\\').replace(/([$'])/g, '\\$1');
    };
    LiteralTranspiler.prototype.handleReifiedArray = function (node) {
        if (node.parent.kind !== ts.SyntaxKind.TypeAssertionExpression)
            return;
        var ta = node.parent;
        if (ta.type.kind !== ts.SyntaxKind.ArrayType)
            return;
        this.emit('<');
        this.visit(ta.type.elementType);
        this.emit('>');
        return true;
    };
    LiteralTranspiler.prototype.handleReifiedMap = function (node) {
        if (node.parent.kind !== ts.SyntaxKind.TypeAssertionExpression)
            return;
        var ta = node.parent;
        if (ta.type.kind !== ts.SyntaxKind.TypeLiteral)
            return;
        var it = this.maybeDestructureIndexType(ta.type);
        if (!it) {
            this.reportError(node, 'expected {[k]: v} type on object literal');
            return;
        }
        this.emit('<');
        this.visit(it[0]);
        this.emit(',');
        this.visit(it[1]);
        this.emit('>');
    };
    return LiteralTranspiler;
}(base.TranspilerBase));
exports.__esModule = true;
exports["default"] = LiteralTranspiler;

//# sourceMappingURL=literal.js.map
