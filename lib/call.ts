import ts = require('typescript');
import base = require('./base');
import ts2dart = require('./main');
import {FacadeConverter} from "./facade_converter";

export default class CallTranspiler extends base.TranspilerBase {
  constructor(tr: ts2dart.Transpiler, private fc: FacadeConverter) { super(tr); }

  visitNode(node: ts.Node): boolean {
    switch (node.kind) {
      case ts.SyntaxKind.Block:
        // This is a bit ugly: to separate Declarations from Calls, this code has to special case
        // blocks that are actually constructor bodies.
        if (node.parent && node.parent.kind === ts.SyntaxKind.Constructor) {
          return this.visitConstructorBody(<ts.ConstructorDeclaration>node.parent);
        }
        return false;
      case ts.SyntaxKind.NewExpression:
        if (this.hasAncestor(node, ts.SyntaxKind.Decorator)) {
          // Constructor calls in annotations must be const constructor calls.
          this.emit('const');
        } else if (this.isInsideConstExpr(node)) {
          this.emit('const');
        } else {
          this.emit('new');
        }
        var newExpr = <ts.NewExpression>node;
        if (this.fc.maybeHandleCall(newExpr)) break;
        this.visitCall(newExpr);
        break;
      case ts.SyntaxKind.CallExpression:
        var callExpr = <ts.CallExpression>node;
        if (this.fc.maybeHandleCall(callExpr)) break;
        if (this.maybeHandleSuperCall(callExpr)) break;
        this.visitCall(callExpr);
        break;
      case ts.SyntaxKind.SuperKeyword:
        this.emit('super');
        break;
      default:
        return false;
    }
    return true;
  }

  private visitCall(c: ts.CallExpression) {
    this.visit(c.expression);
    // Type arguments on methods are ignored. Dart doesn't support
    // generic methods, and while we don't allow them to be declared
    // in ts2dart, it's possible the method being called is not
    // transpiled by ts2dart.
    if (c.typeArguments && c.kind === ts.SyntaxKind.NewExpression) {
      this.maybeVisitTypeArguments(c);
    }
    this.emit('(');
    if (c.arguments && !this.handleNamedParamsCall(c)) {
      this.visitList(c.arguments);
    }
    this.emit(')');
  }

  private isInsideConstExpr(node: ts.Node): boolean {
    return this.isConstCall(
        <ts.CallExpression>this.getAncestor(node, ts.SyntaxKind.CallExpression));
  }

  private isConstCall(node: ts.CallExpression): boolean {
    // TODO: Align with facade_converter.ts
    return node && base.ident(node.expression) === 'CONST_EXPR';
  }

  private handleNamedParamsCall(c: ts.CallExpression): boolean {
    // Preamble: This is all committed in the name of backwards compat with the traceur transpiler.

    // Terrible hack: transform foo(a, b, {c: d}) into foo(a, b, c: d), which is Dart's calling
    // syntax for named/optional parameters. An alternative would be to transform the method
    // declaration to take a plain object literal and destructure in the method, but then client
    // code written against Dart wouldn't get nice named parameters.
    if (c.arguments.length === 0) return false;
    var last = c.arguments[c.arguments.length - 1];
    if (last.kind !== ts.SyntaxKind.ObjectLiteralExpression) return false;
    var objLit = <ts.ObjectLiteralExpression>last;
    if (objLit.properties.length === 0) return false;
    // Even worse: foo(a, b, {'c': d}) is considered to *not* be a named parameters call.
    var hasNonPropAssignments = objLit.properties.some(
        (p) =>
            (p.kind != ts.SyntaxKind.PropertyAssignment ||
             (<ts.PropertyAssignment>p).name.kind !== ts.SyntaxKind.Identifier));
    if (hasNonPropAssignments) return false;

    var len = c.arguments.length - 1;
    this.visitList(c.arguments.slice(0, len));
    if (len) this.emit(',');
    var props = objLit.properties;
    for (var i = 0; i < props.length; i++) {
      var prop = <ts.PropertyAssignment>props[i];
      this.emit(base.ident(prop.name));
      this.emit(':');
      this.visit(prop.initializer);
      if (i < objLit.properties.length - 1) this.emit(',');
    }
    return true;
  }

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
  private visitConstructorBody(ctor: ts.ConstructorDeclaration): boolean {
    var body = ctor.body;
    if (!body) return false;

    var errorAssignmentsSuper = 'const constructors can only contain assignments and super calls';
    var errorThisAssignment = 'assignments in const constructors must assign into this.';

    var parent = <base.ClassLike>ctor.parent;
    var parentIsConst = this.isConst(parent);
    var superCall: ts.CallExpression;
    var expressions: ts.Expression[] = [];
    // Find super() calls and (if in a const ctor) collect assignment expressions (not statements!)
    body.statements.forEach((stmt) => {
      if (stmt.kind !== ts.SyntaxKind.ExpressionStatement) {
        if (parentIsConst) this.reportError(stmt, errorAssignmentsSuper);
        return;
      }
      var nestedExpr = (<ts.ExpressionStatement>stmt).expression;

      // super() call?
      if (nestedExpr.kind === ts.SyntaxKind.CallExpression) {
        var callExpr = <ts.CallExpression>nestedExpr;
        if (callExpr.expression.kind !== ts.SyntaxKind.SuperKeyword) {
          if (parentIsConst) this.reportError(stmt, errorAssignmentsSuper);
          return;
        }
        superCall = callExpr;
        return;
      }

      // this.x assignment?
      if (parentIsConst) {
        // Check for assignment.
        if (nestedExpr.kind !== ts.SyntaxKind.BinaryExpression) {
          this.reportError(nestedExpr, errorAssignmentsSuper);
          return;
        }
        var binExpr = <ts.BinaryExpression>nestedExpr;
        if (binExpr.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
          this.reportError(binExpr, errorAssignmentsSuper);
          return;
        }
        // Check for 'this.'
        if (binExpr.left.kind !== ts.SyntaxKind.PropertyAccessExpression) {
          this.reportError(binExpr, errorThisAssignment);
          return;
        }
        var lhs = <ts.PropertyAccessExpression>binExpr.left;
        if (lhs.expression.kind !== ts.SyntaxKind.ThisKeyword) {
          this.reportError(binExpr, errorThisAssignment);
          return;
        }
        var ident = lhs.name;
        binExpr.left = ident;
        expressions.push(nestedExpr);
      }
    });

    var hasInitializerExpr = expressions.length > 0;
    if (hasInitializerExpr) {
      // Write out the assignments.
      this.emit(':');
      this.visitList(expressions);
    }
    if (superCall) {
      this.emit(hasInitializerExpr ? ',' : ':');
      this.emit('super (');
      if (!this.handleNamedParamsCall(superCall)) {
        this.visitList(superCall.arguments);
      }
      this.emit(')');
    }
    if (parentIsConst) {
      // Const ctors don't have bodies.
      this.emit(';');
      return true;  // completely handled.
    } else {
      return false;
    }
  }

  /**
   * Checks whether `callExpr` is a super() call that should be ignored because it was already
   * handled by `maybeEmitSuperInitializer` above.
   */
  private maybeHandleSuperCall(callExpr: ts.CallExpression): boolean {
    if (callExpr.expression.kind !== ts.SyntaxKind.SuperKeyword) return false;
    // Sanity check that there was indeed a ctor directly above this call.
    var exprStmt = callExpr.parent;
    var ctorBody = exprStmt.parent;
    var ctor = ctorBody.parent;
    if (ctor.kind !== ts.SyntaxKind.Constructor) {
      this.reportError(callExpr, 'super calls must be immediate children of their constructors');
      return false;
    }
    this.emit('/* super call moved to initializer */');
    return true;
  }
}
