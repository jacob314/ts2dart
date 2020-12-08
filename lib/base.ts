import * as ts from 'typescript';
import {Transpiler} from './main';

export type ClassLike = ts.ClassDeclaration | ts.InterfaceDeclaration;

export function ident(n: ts.Node): string {
  if (n.kind === ts.SyntaxKind.Identifier) return (<ts.Identifier>n).text;
  if (n.kind === ts.SyntaxKind.QualifiedName) {
    let qname = (<ts.QualifiedName>n);
    let leftName = ident(qname.left);
    if (leftName) return leftName + '.' + ident(qname.right);
  }
  return null;
}

export class TranspilerBase {
  private idCounter: number = 0;
  constructor(private transpiler: Transpiler) {}

  visit(n: ts.Node) { this.transpiler.visit(n); }
  emit(s: string) { this.transpiler.emit(s); }
  emitBefore(s: string, search: string) { this.transpiler.emitBefore(s, search); }
  emitNoSpace(s: string) { this.transpiler.emitNoSpace(s); }
  reportError(n: ts.Node, message: string) { this.transpiler.reportError(n, message); }

  visitNode(n: ts.Node): boolean { throw new Error('not implemented'); }

  visitEach(nodes: ts.Node[]) { nodes.forEach((n) => this.visit(n)); }

  visitEachIfPresent(nodes?: ts.Node[]) {
    if (nodes) this.visitEach(nodes);
  }

  visitList(nodes: ts.Node[], separator = ',') {
    for (let i = 0; i < nodes.length; i++) {
      this.visit(nodes[i]);
      if (i < nodes.length - 1) this.emit(separator);
    }
  }

  uniqueId(name: string): string {
    const id = this.idCounter++;
    return `_${name}\$\$ts2dart\$${id}`;
  }

  assert(c: ts.Node, condition: boolean, reason: string): void {
    if (!condition) {
      this.reportError(c, reason);
      throw new Error(reason);
    }
  }

  getAncestor(n: ts.Node, kind: ts.SyntaxKind): ts.Node {
    for (let parent = n; parent; parent = parent.parent) {
      if (parent.kind === kind) return parent;
    }
    return null;
  }

  hasAncestor(n: ts.Node, kind: ts.SyntaxKind): boolean { return !!this.getAncestor(n, kind); }

  hasAnnotation(decorators: ts.NodeArray<ts.Decorator>, name: string): boolean {
    if (!decorators) return false;
    return decorators.some((d) => {
      let decName = ident(d.expression);
      if (decName === name) return true;
      if (d.expression.kind !== ts.SyntaxKind.CallExpression) return false;
      let callExpr = (<ts.CallExpression>d.expression);
      decName = ident(callExpr.expression);
      return decName === name;
    });
  }

  hasFlag(n: {flags: number}, flag: ts.NodeFlags): boolean {
    return n && (n.flags & flag) !== 0 || false;
  }

  maybeDestructureIndexType(node: ts.TypeLiteralNode): [ts.TypeNode, ts.TypeNode] {
    let members = node.members;
    if (members.length !== 1 || members[0].kind !== ts.SyntaxKind.IndexSignature) {
      return null;
    }
    let indexSig = <ts.IndexSignatureDeclaration>(members[0]);
    if (indexSig.parameters.length > 1) {
      this.reportError(indexSig, 'Expected an index signature to have a single parameter');
    }
    return [indexSig.parameters[0].type, indexSig.type];
  }


  getRelativeFileName(fileName: string): string {
    return this.transpiler.getRelativeFileName(fileName);
  }

  maybeVisitTypeArguments(n: {typeArguments?: ts.NodeArray<ts.TypeNode>}) {
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
  }
}
