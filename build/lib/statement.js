"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var ts = require('typescript');
var base = require('./base');
var StatementTranspiler = (function (_super) {
    __extends(StatementTranspiler, _super);
    function StatementTranspiler(tr) {
        _super.call(this, tr);
    }
    StatementTranspiler.prototype.visitNode = function (node) {
        switch (node.kind) {
            case ts.SyntaxKind.EmptyStatement:
                this.emit(';');
                break;
            case ts.SyntaxKind.ReturnStatement:
                var retStmt = node;
                this.emit('return');
                if (retStmt.expression)
                    this.visit(retStmt.expression);
                this.emit(';');
                break;
            case ts.SyntaxKind.BreakStatement:
            case ts.SyntaxKind.ContinueStatement:
                var breakContinue = node;
                this.emit(breakContinue.kind === ts.SyntaxKind.BreakStatement ? 'break' : 'continue');
                if (breakContinue.label)
                    this.visit(breakContinue.label);
                this.emit(';');
                break;
            case ts.SyntaxKind.VariableStatement:
                var variableStmt = node;
                this.visit(variableStmt.declarationList);
                this.emit(';');
                break;
            case ts.SyntaxKind.ExpressionStatement:
                var expr = node;
                this.visit(expr.expression);
                this.emit(';');
                break;
            case ts.SyntaxKind.SwitchStatement:
                var switchStmt = node;
                this.emit('switch (');
                this.visit(switchStmt.expression);
                this.emit(')');
                this.visit(switchStmt.caseBlock);
                break;
            case ts.SyntaxKind.CaseBlock:
                this.emit('{');
                this.visitEach(node.clauses);
                this.emit('}');
                break;
            case ts.SyntaxKind.CaseClause:
                var caseClause = node;
                this.emit('case');
                this.visit(caseClause.expression);
                this.emit(':');
                this.visitEach(caseClause.statements);
                break;
            case ts.SyntaxKind.DefaultClause:
                this.emit('default :');
                this.visitEach(node.statements);
                break;
            case ts.SyntaxKind.IfStatement:
                var ifStmt = node;
                this.emit('if (');
                this.visit(ifStmt.expression);
                this.emit(')');
                this.visit(ifStmt.thenStatement);
                if (ifStmt.elseStatement) {
                    this.emit('else');
                    this.visit(ifStmt.elseStatement);
                }
                break;
            case ts.SyntaxKind.ForStatement:
                var forStmt = node;
                this.emit('for (');
                if (forStmt.initializer)
                    this.visit(forStmt.initializer);
                this.emit(';');
                if (forStmt.condition)
                    this.visit(forStmt.condition);
                this.emit(';');
                if (forStmt.incrementor)
                    this.visit(forStmt.incrementor);
                this.emit(')');
                this.visit(forStmt.statement);
                break;
            case ts.SyntaxKind.ForInStatement:
                // TODO(martinprobst): Dart's for-in loops actually have different semantics, they are more
                // like for-of loops, iterating over collections.
                var forInStmt = node;
                this.emit('for (');
                if (forInStmt.initializer)
                    this.visit(forInStmt.initializer);
                this.emit('in');
                this.visit(forInStmt.expression);
                this.emit(')');
                this.visit(forInStmt.statement);
                break;
            case ts.SyntaxKind.ForOfStatement:
                var forOfStmt = node;
                this.emit('for (');
                if (forOfStmt.initializer)
                    this.visit(forOfStmt.initializer);
                this.emit('in');
                this.visit(forOfStmt.expression);
                this.emit(')');
                this.visit(forOfStmt.statement);
                break;
            case ts.SyntaxKind.WhileStatement:
                var whileStmt = node;
                this.emit('while (');
                this.visit(whileStmt.expression);
                this.emit(')');
                this.visit(whileStmt.statement);
                break;
            case ts.SyntaxKind.DoStatement:
                var doStmt = node;
                this.emit('do');
                this.visit(doStmt.statement);
                this.emit('while (');
                this.visit(doStmt.expression);
                this.emit(') ;');
                break;
            case ts.SyntaxKind.ThrowStatement:
                var throwStmt = node;
                var surroundingCatchClause = this.getAncestor(throwStmt, ts.SyntaxKind.CatchClause);
                if (surroundingCatchClause) {
                    var ref = surroundingCatchClause.variableDeclaration;
                    if (ref.getText() === throwStmt.expression.getText()) {
                        this.emit('rethrow');
                        this.emit(';');
                        break;
                    }
                }
                this.emit('throw');
                this.visit(throwStmt.expression);
                this.emit(';');
                break;
            case ts.SyntaxKind.TryStatement:
                var tryStmt = node;
                this.emit('try');
                this.visit(tryStmt.tryBlock);
                if (tryStmt.catchClause) {
                    this.visit(tryStmt.catchClause);
                }
                if (tryStmt.finallyBlock) {
                    this.emit('finally');
                    this.visit(tryStmt.finallyBlock);
                }
                break;
            case ts.SyntaxKind.CatchClause:
                var ctch = node;
                if (ctch.variableDeclaration.type) {
                    this.emit('on');
                    this.visit(ctch.variableDeclaration.type);
                }
                this.emit('catch');
                this.emit('(');
                this.visit(ctch.variableDeclaration.name);
                this.emit(',');
                this.visit(ctch.variableDeclaration.name);
                this.emitNoSpace('_stack');
                this.emit(')');
                this.visit(ctch.block);
                break;
            case ts.SyntaxKind.Block:
                this.emit('{');
                this.visitEach(node.statements);
                this.emit('}');
                break;
            default:
                return false;
        }
        return true;
    };
    return StatementTranspiler;
}(base.TranspilerBase));
exports.__esModule = true;
exports["default"] = StatementTranspiler;

//# sourceMappingURL=statement.js.map
