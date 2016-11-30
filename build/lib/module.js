"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var ts = require('typescript');
var base = require('./base');
var ModuleTranspiler = (function (_super) {
    __extends(ModuleTranspiler, _super);
    function ModuleTranspiler(tr, fc, generateLibraryName) {
        _super.call(this, tr);
        this.fc = fc;
        this.generateLibraryName = generateLibraryName;
    }
    ModuleTranspiler.prototype.visitNode = function (node) {
        switch (node.kind) {
            case ts.SyntaxKind.SourceFile:
                var sf = node;
                if (this.generateLibraryName) {
                    this.emit('library');
                    this.emit(this.getLibraryName(sf.fileName));
                    this.emit(';');
                }
                this.fc.emitExtraImports(sf);
                ts.forEachChild(sf, this.visit.bind(this));
                break;
            case ts.SyntaxKind.EndOfFileToken:
                ts.forEachChild(node, this.visit.bind(this));
                break;
            case ts.SyntaxKind.ImportDeclaration:
                var importDecl = node;
                if (importDecl.importClause) {
                    if (this.isEmptyImport(importDecl))
                        return true;
                    this.emit('import');
                    this.visitExternalModuleReferenceExpr(importDecl.moduleSpecifier);
                    this.visit(importDecl.importClause);
                }
                else {
                    this.reportError(importDecl, 'bare import is unsupported');
                }
                this.emit(';');
                break;
            case ts.SyntaxKind.ImportClause:
                var importClause = node;
                if (importClause.name)
                    this.fc.visitTypeName(importClause.name);
                if (importClause.namedBindings) {
                    this.visit(importClause.namedBindings);
                }
                break;
            case ts.SyntaxKind.NamespaceImport:
                var nsImport = node;
                this.emit('as');
                this.fc.visitTypeName(nsImport.name);
                break;
            case ts.SyntaxKind.NamedImports:
                this.emit('show');
                var used = this.filterImports(node.elements);
                if (used.length === 0) {
                    this.reportError(node, 'internal error, used imports must not be empty');
                }
                this.visitList(used);
                break;
            case ts.SyntaxKind.NamedExports:
                var exportElements = node.elements;
                this.emit('show');
                if (exportElements.length === 0)
                    this.reportError(node, 'empty export list');
                this.visitList(node.elements);
                break;
            case ts.SyntaxKind.ImportSpecifier:
            case ts.SyntaxKind.ExportSpecifier:
                var spec = node;
                if (spec.propertyName) {
                    this.reportError(spec.propertyName, 'import/export renames are unsupported in Dart');
                }
                this.fc.visitTypeName(spec.name);
                break;
            case ts.SyntaxKind.ExportDeclaration:
                var exportDecl = node;
                this.emit('export');
                if (exportDecl.moduleSpecifier) {
                    this.visitExternalModuleReferenceExpr(exportDecl.moduleSpecifier);
                }
                else {
                    this.reportError(node, 're-exports must have a module URL (export x from "./y").');
                }
                if (exportDecl.exportClause)
                    this.visit(exportDecl.exportClause);
                this.emit(';');
                break;
            case ts.SyntaxKind.ImportEqualsDeclaration:
                var importEqDecl = node;
                this.emit('import');
                this.visit(importEqDecl.moduleReference);
                this.emit('as');
                this.fc.visitTypeName(importEqDecl.name);
                this.emit(';');
                break;
            case ts.SyntaxKind.ExternalModuleReference:
                this.visitExternalModuleReferenceExpr(node.expression);
                break;
            default:
                return false;
        }
        return true;
    };
    ModuleTranspiler.isIgnoredImport = function (e) {
        // TODO: unify with facade_converter.ts
        var name = base.ident(e.name);
        switch (name) {
            case 'CONST':
            case 'CONST_EXPR':
            case 'normalizeBlank':
            case 'forwardRef':
            case 'ABSTRACT':
            case 'IMPLEMENTS':
                return true;
            default:
                return false;
        }
    };
    ModuleTranspiler.prototype.visitExternalModuleReferenceExpr = function (expr) {
        // TODO: what if this isn't a string literal?
        var moduleName = expr;
        var text = moduleName.text;
        if (text.match(/^\.\//)) {
            // Strip './' to be more Dart-idiomatic.
            text = text.substring(2).replace(/([A-Z])/g, function ($1) { return "_" + $1.toLowerCase(); });
            if (text.charAt(0) == '_') {
                text = text.substring(1);
            }
            text = text.replace(/\/_/g, '\/');
        }
        else if (!text.match(/^\.\.\//)) {
            // Replace '@angular' with 'angular2' for Dart.
            text = text.replace(/^@keikai\//, 'keikai/');
            // Unprefixed/absolute imports are package imports.
            text = 'package:' + text;
        }
        text = JSON.stringify(text + '.dart');
        this.emit("'" + (text.substring(1, text.length - 1)) + "'");
    };
    ModuleTranspiler.prototype.isEmptyImport = function (n) {
        var bindings = n.importClause.namedBindings;
        if (bindings.kind !== ts.SyntaxKind.NamedImports)
            return false;
        var elements = bindings.elements;
        // An import list being empty *after* filtering is ok, but if it's empty in the code itself,
        // it's nonsensical code, so probably a programming error.
        if (elements.length === 0)
            this.reportError(n, 'empty import list');
        return elements.every(ModuleTranspiler.isIgnoredImport);
    };
    ModuleTranspiler.prototype.filterImports = function (ns) {
        return ns.filter(function (e) { return !ModuleTranspiler.isIgnoredImport(e); });
    };
    ModuleTranspiler.prototype.getLibraryName = function (fileName) {
        fileName = this.getRelativeFileName(fileName);
        var parts = fileName.split('/');
        return parts.filter(function (p) { return p.length > 0; })
            .map(function (p) { return p.replace(/^@/, ''); })
            .map(function (p) { return p.replace(/[^\w.]/g, '_'); })
            .map(function (p) { return p.replace(/\.[jt]s$/g, ''); })
            .map(function (p) { return ModuleTranspiler.DART_RESERVED_WORDS.indexOf(p) !== -1 ? '_' + p : p; })
            .join('.');
    };
    // For the Dart keyword list see
    // https://www.dartlang.org/docs/dart-up-and-running/ch02.html#keywords
    ModuleTranspiler.DART_RESERVED_WORDS = ('assert break case catch class const continue default do else enum extends false final ' +
        'finally for if in is new null rethrow return super switch this throw true try let void ' +
        'while with')
        .split(/ /);
    return ModuleTranspiler;
}(base.TranspilerBase));
exports.__esModule = true;
exports["default"] = ModuleTranspiler;

//# sourceMappingURL=module.js.map
