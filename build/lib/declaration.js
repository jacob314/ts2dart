"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var ts = require('typescript');
var base = require('./base');
var DeclarationTranspiler = (function (_super) {
    __extends(DeclarationTranspiler, _super);
    function DeclarationTranspiler(tr, fc, enforceUnderscoreConventions) {
        _super.call(this, tr);
        this.fc = fc;
        this.enforceUnderscoreConventions = enforceUnderscoreConventions;
    }
    DeclarationTranspiler.prototype.visitNode = function (node) {
        switch (node.kind) {
            case ts.SyntaxKind.VariableDeclarationList:
                // Note: VariableDeclarationList can only occur as part of a for loop.
                var varDeclList = node;
                this.visitList(varDeclList.declarations);
                break;
            case ts.SyntaxKind.VariableDeclaration:
                var varDecl = node;
                this.visitVariableDeclarationType(varDecl);
                this.visit(varDecl.name);
                if (varDecl.initializer) {
                    this.emit('=');
                    this.visit(varDecl.initializer);
                }
                break;
            case ts.SyntaxKind.ClassDeclaration:
                var classDecl = node;
                if (classDecl.modifiers && (classDecl.modifiers.flags & ts.NodeFlags.Abstract)) {
                    this.visitClassLike('abstract class', classDecl);
                }
                else {
                    this.visitClassLike('class', classDecl);
                }
                break;
            case ts.SyntaxKind.InterfaceDeclaration:
                var ifDecl = node;
                // Function type interface in an interface with a single declaration
                // of a call signature (http://goo.gl/ROC5jN).
                if (ifDecl.members.length === 1 && ifDecl.members[0].kind === ts.SyntaxKind.CallSignature) {
                    var member_1 = ifDecl.members[0];
                    this.visitFunctionTypedefInterface(ifDecl.name.text, member_1, ifDecl.typeParameters);
                }
                else {
                    this.visitClassLike('abstract class', ifDecl);
                }
                break;
            case ts.SyntaxKind.HeritageClause:
                var heritageClause = node;
                if (heritageClause.token === ts.SyntaxKind.ExtendsKeyword &&
                    heritageClause.parent.kind !== ts.SyntaxKind.InterfaceDeclaration) {
                    this.emit('extends');
                }
                else {
                    this.emit('implements');
                }
                // Can only have one member for extends clauses.
                this.visitList(heritageClause.types);
                break;
            case ts.SyntaxKind.ExpressionWithTypeArguments:
                var exprWithTypeArgs = node;
                this.visit(exprWithTypeArgs.expression);
                this.maybeVisitTypeArguments(exprWithTypeArgs);
                break;
            case ts.SyntaxKind.EnumDeclaration:
                var decl = node;
                // The only legal modifier for an enum decl is const.
                var isConst = decl.modifiers && (decl.modifiers.flags & ts.NodeFlags.Const);
                if (isConst) {
                    this.reportError(node, 'const enums are not supported');
                }
                this.emit('enum');
                this.fc.visitTypeName(decl.name);
                this.emit('{');
                // Enums can be empty in TS ...
                if (decl.members.length === 0) {
                    // ... but not in Dart.
                    this.reportError(node, 'empty enums are not supported');
                }
                this.visitList(decl.members);
                this.emit('}');
                break;
            case ts.SyntaxKind.EnumMember:
                var member = node;
                this.visit(member.name);
                if (member.initializer) {
                    this.reportError(node, 'enum initializers are not supported');
                }
                break;
            case ts.SyntaxKind.Constructor:
                var ctorDecl = node;
                // Find containing class name.
                var className = void 0;
                for (var parent_1 = ctorDecl.parent; parent_1; parent_1 = parent_1.parent) {
                    if (parent_1.kind === ts.SyntaxKind.ClassDeclaration) {
                        className = parent_1.name;
                        break;
                    }
                }
                if (!className)
                    this.reportError(ctorDecl, 'cannot find outer class node');
                this.visitDeclarationMetadata(ctorDecl);
                if (this.fc.isConstClass(ctorDecl.parent)) {
                    this.emit('const');
                }
                this.visit(className);
                this.visitParameters(ctorDecl.parameters);
                this.visit(ctorDecl.body);
                break;
            case ts.SyntaxKind.PropertyDeclaration:
                this.visitProperty(node);
                break;
            case ts.SyntaxKind.SemicolonClassElement:
                // No-op, don't emit useless declarations.
                break;
            case ts.SyntaxKind.MethodDeclaration:
                this.visitDeclarationMetadata(node);
                this.visitFunctionLike(node);
                break;
            case ts.SyntaxKind.GetAccessor:
                this.visitDeclarationMetadata(node);
                this.visitFunctionLike(node, 'get');
                break;
            case ts.SyntaxKind.SetAccessor:
                this.visitDeclarationMetadata(node);
                this.visitFunctionLike(node, 'set');
                break;
            case ts.SyntaxKind.FunctionDeclaration:
                var funcDecl = node;
                this.visitDecorators(funcDecl.decorators);
                this.visitFunctionLike(funcDecl);
                break;
            case ts.SyntaxKind.ArrowFunction:
                var arrowFunc = node;
                // Dart only allows expressions following the fat arrow operator.
                // If the body is a block, we have to drop the fat arrow and emit an
                // anonymous function instead.
                if (arrowFunc.body.kind === ts.SyntaxKind.Block) {
                    this.visitFunctionLike(arrowFunc);
                }
                else {
                    this.visitParameters(arrowFunc.parameters);
                    this.emit('=>');
                    this.visit(arrowFunc.body);
                }
                break;
            case ts.SyntaxKind.FunctionExpression:
                var funcExpr = node;
                this.visitFunctionLike(funcExpr);
                break;
            case ts.SyntaxKind.PropertySignature:
                var propSig = node;
                this.visitProperty(propSig);
                break;
            case ts.SyntaxKind.MethodSignature:
                var methodSignatureDecl = node;
                this.visitEachIfPresent(methodSignatureDecl.modifiers);
                this.visitFunctionLike(methodSignatureDecl);
                break;
            case ts.SyntaxKind.Parameter:
                var paramDecl = node;
                // Property parameters will have an explicit property declaration, so we just
                // need the dart assignment shorthand to reference the property.
                if (this.hasFlag(paramDecl.modifiers, ts.NodeFlags.Public) ||
                    this.hasFlag(paramDecl.modifiers, ts.NodeFlags.Private) ||
                    this.hasFlag(paramDecl.modifiers, ts.NodeFlags.Protected)) {
                    this.visitDeclarationMetadata(paramDecl);
                    this.emit('this .');
                    this.visit(paramDecl.name);
                    if (paramDecl.initializer) {
                        this.emit('=');
                        this.visit(paramDecl.initializer);
                    }
                    break;
                }
                if (paramDecl.dotDotDotToken)
                    this.reportError(node, 'rest parameters are unsupported');
                if (paramDecl.name.kind === ts.SyntaxKind.ObjectBindingPattern) {
                    this.visitNamedParameter(paramDecl);
                    break;
                }
                this.visitDecorators(paramDecl.decorators);
                if (paramDecl.type && paramDecl.type.kind === ts.SyntaxKind.FunctionType) {
                    // Dart uses "returnType paramName ( parameters )" syntax.
                    var fnType = paramDecl.type;
                    var hasRestParameter = fnType.parameters.some(function (p) { return !!p.dotDotDotToken; });
                    if (hasRestParameter) {
                        // Dart does not support rest parameters/varargs, degenerate to just "Function".
                        this.emit('Function');
                        this.visit(paramDecl.name);
                    }
                    else {
                        this.visit(fnType.type);
                        this.visit(paramDecl.name);
                        this.visitParameters(fnType.parameters);
                    }
                }
                else {
                    if (paramDecl.type)
                        this.visit(paramDecl.type);
                    this.visit(paramDecl.name);
                }
                if (paramDecl.initializer) {
                    this.emit('=');
                    this.visit(paramDecl.initializer);
                }
                break;
            case ts.SyntaxKind.StaticKeyword:
                this.emit('static');
                break;
            case ts.SyntaxKind.AbstractKeyword:
                // Abstract methods in Dart simply lack implementation,
                // and don't use the 'abstract' modifier
                // Abstract classes are handled in `case ts.SyntaxKind.ClassDeclaration` above.
                break;
            case ts.SyntaxKind.PrivateKeyword:
                this.emit('/*private*/');
                // no-op, handled through '_' naming convention in Dart.
                break;
            case ts.SyntaxKind.PublicKeyword:
                this.emit('/*public*/');
                break;
            case ts.SyntaxKind.ProtectedKeyword:
                this.emit('/*protected*/');
                break;
            case ts.SyntaxKind.AwaitExpression:
                // Handled in `visitDeclarationMetadata` below.
                this.emit('await');
                this.visit(node.expression);
                break;
            case ts.SyntaxKind.AsyncKeyword:
                this.__async = true;
                break;
            case ts.SyntaxKind.ObjectBindingPattern:
                this.emit('/*');
                var n = node;
                var first = true;
                for (var _i = 0, _a = n.elements; _i < _a.length; _i++) {
                    var e = _a[_i];
                    if (!first) {
                        this.emit(',');
                    }
                    first = false;
                    this.emit(e.name.text);
                }
                this.emit('*/');
                break;
            default:
                return false;
        }
        return true;
    };
    DeclarationTranspiler.prototype.visitVariableDeclarationType = function (varDecl) {
        /* Note: VariableDeclarationList can only occur as part of a for loop. This helper method
         * is meant for processing for-loop variable declaration types only.
         *
         * In Dart, all variables in a variable declaration list must have the same type. Since
         * we are doing syntax directed translation, we cannot reliably determine if distinct
         * variables are declared with the same type or not. Hence we support the following cases:
         *
         * - A variable declaration list with a single variable can be explicitly typed.
         * - When more than one variable is in the list, all must be implicitly typed.
         */
        var firstDecl = varDecl.parent.declarations[0];
        var msg = 'Variables in a declaration list of more than one variable cannot by typed';
        var isFinal = this.hasFlag(varDecl.parent, ts.NodeFlags.Const);
        var isConst = false;
        if (isFinal && varDecl.initializer) {
            // "const" in TypeScript/ES6 corresponds to "final" in Dart, i.e. reference constness.
            // If a "const" variable is immediately initialized to a CONST_EXPR(), special case it to be
            // a deeply const constant, and generate "const ...".
            isConst = varDecl.initializer.kind === ts.SyntaxKind.StringLiteral ||
                varDecl.initializer.kind === ts.SyntaxKind.NumericLiteral ||
                this.fc.isConstExpr(varDecl.initializer);
        }
        if (firstDecl === varDecl) {
            if (isConst) {
                this.emit('const');
            }
            else if (isFinal) {
                this.emit('final');
            }
            if (!varDecl.type) {
                if (!isFinal)
                    this.emit('var');
            }
            else if (varDecl.parent.declarations.length > 1) {
                this.reportError(varDecl, msg);
            }
            else {
                this.visit(varDecl.type);
            }
        }
        else if (varDecl.type) {
            this.reportError(varDecl, msg);
        }
    };
    DeclarationTranspiler.prototype.visitFunctionLike = function (fn, accessor) {
        this.fc.pushTypeParameterNames(fn);
        try {
            if (fn.type) {
                if (fn.kind === ts.SyntaxKind.ArrowFunction ||
                    fn.kind === ts.SyntaxKind.FunctionExpression) {
                    // The return type is silently dropped for function expressions (including arrow
                    // functions), it is not supported in Dart.
                    this.emit('/*');
                    this.visit(fn.type);
                    this.emit('*/');
                }
                else {
                    this.visit(fn.type);
                }
            }
            if (accessor)
                this.emit(accessor);
            if (fn.name)
                this.visit(fn.name);
            if (fn.typeParameters) {
                this.emit('/*<');
                // Emit the names literally instead of visiting, otherwise they will be replaced with the
                // comment hack themselves.
                this.emit(fn.typeParameters.map(function (p) { return base.ident(p.name); }).join(', '));
                this.emit('>*/');
            }
            // Dart does not even allow the parens of an empty param list on getter
            if (accessor !== 'get') {
                this.visitParameters(fn.parameters);
            }
            else {
                if (fn.parameters && fn.parameters.length > 0) {
                    this.reportError(fn, 'getter should not accept parameters');
                }
            }
            if (fn.body) {
                this.visit(fn.body);
            }
            else {
                this.emit(';');
            }
        }
        finally {
            this.fc.popTypeParameterNames(fn);
        }
    };
    DeclarationTranspiler.prototype.visitParameters = function (parameters) {
        this.emit('(');
        var firstInitParamIdx = 0;
        for (; firstInitParamIdx < parameters.length; firstInitParamIdx++) {
            // ObjectBindingPatterns are handled within the parameter visit.
            var isOpt = parameters[firstInitParamIdx].initializer || parameters[firstInitParamIdx].questionToken;
            if (isOpt && parameters[firstInitParamIdx].name.kind !== ts.SyntaxKind.ObjectBindingPattern) {
                break;
            }
        }
        if (firstInitParamIdx !== 0) {
            var requiredParams = parameters.slice(0, firstInitParamIdx);
            this.visitList(requiredParams);
        }
        if (firstInitParamIdx !== parameters.length) {
            if (firstInitParamIdx !== 0)
                this.emit(',');
            var positionalOptional = parameters.slice(firstInitParamIdx, parameters.length);
            this.emit('[');
            this.visitList(positionalOptional);
            this.emit(']');
        }
        this.emit(')');
        if (this['__async']) {
            this.emit('async');
            this['__async'] = false;
        }
    };
    /**
     * Visit a property declaration.
     * In the special case of property parameters in a constructor, we also allow a parameter to be
     * emitted as a property.
     */
    DeclarationTranspiler.prototype.visitProperty = function (decl, isParameter) {
        if (isParameter === void 0) { isParameter = false; }
        if (!isParameter)
            this.visitDeclarationMetadata(decl);
        var containingClass = (isParameter ? decl.parent.parent : decl.parent);
        var isConstField = this.fc.hasConstComment(decl) || this.hasAnnotation(decl.decorators, 'CONST');
        var hasConstCtor = this.fc.isConstClass(containingClass);
        if (isConstField) {
            // const implies final
            this.emit('const');
        }
        else {
            if (hasConstCtor) {
                this.emit('final');
            }
        }
        if (decl.type) {
            this.visit(decl.type);
        }
        else if (!isConstField && !hasConstCtor) {
            this.emit('var');
        }
        this.visit(decl.name);
        if (decl.initializer && !isParameter) {
            this.emit('=');
            this.visit(decl.initializer);
        }
        this.emit(';');
    };
    DeclarationTranspiler.prototype.visitClassLike = function (keyword, decl) {
        var _this = this;
        this.visitDecorators(decl.decorators);
        this.emit(keyword);
        this.fc.visitTypeName(decl.name);
        if (decl.typeParameters) {
            this.emit('<');
            this.visitList(decl.typeParameters);
            this.emit('>');
        }
        this.visitEachIfPresent(decl.heritageClauses);
        this.emit('{');
        // Synthesize explicit properties for ctor with 'property parameters'
        var synthesizePropertyParam = function (param) {
            if (_this.hasFlag(param.modifiers, ts.NodeFlags.Public) ||
                _this.hasFlag(param.modifiers, ts.NodeFlags.Private) ||
                _this.hasFlag(param.modifiers, ts.NodeFlags.Protected)) {
                // TODO: we should enforce the underscore prefix on privates
                _this.visitProperty(param, true);
            }
        };
        decl.members
            .filter(function (m) { return m.kind === ts.SyntaxKind.Constructor; })
            .forEach(function (ctor) {
            return ctor.parameters.forEach(synthesizePropertyParam);
        });
        this.visitEachIfPresent(decl.members);
        // Generate a constructor to host the const modifier, if needed
        if (this.fc.isConstClass(decl) &&
            !decl.members
                .some(function (m) { return m.kind === ts.SyntaxKind.Constructor; })) {
            this.emit('const');
            this.fc.visitTypeName(decl.name);
            this.emit('();');
        }
        this.emit('}');
    };
    DeclarationTranspiler.prototype.visitDecorators = function (decorators) {
        var _this = this;
        if (!decorators)
            return;
        decorators.forEach(function (d) {
            // Special case @CONST
            var name = base.ident(d.expression);
            if (!name && d.expression.kind === ts.SyntaxKind.CallExpression) {
                // Unwrap @CONST()
                var callExpr = d.expression;
                name = base.ident(callExpr.expression);
            }
            // Make sure these match IGNORED_ANNOTATIONS below.
            if (name === 'CONST') {
                // Ignore @CONST - it is handled above in visitClassLike.
                return;
            }
            _this.emit('@');
            _this.visit(d.expression);
        });
    };
    DeclarationTranspiler.prototype.visitDeclarationMetadata = function (decl) {
        this.visitDecorators(decl.decorators);
        this.visitEachIfPresent(decl.modifiers);
        if (this.hasFlag(decl.modifiers, ts.NodeFlags.Protected)) {
            // this.reportError(decl, 'protected declarations are unsupported');
            return;
        }
        if (!this.enforceUnderscoreConventions)
            return;
        // Early return in case this is a decl with no name, such as a constructor
        if (!decl.name)
            return;
        var name = base.ident(decl.name);
        if (!name)
            return;
        var isPrivate = this.hasFlag(decl.modifiers, ts.NodeFlags.Private);
        var matchesPrivate = !!name.match(/^_/);
        if (isPrivate && !matchesPrivate) {
            this.reportError(decl, 'private members must be prefixed with "_"');
        }
        if (!isPrivate && matchesPrivate) {
            this.reportError(decl, 'public members must not be prefixed with "_"');
        }
    };
    DeclarationTranspiler.prototype.visitNamedParameter = function (paramDecl) {
        this.visitDecorators(paramDecl.decorators);
        var bp = paramDecl.name;
        var propertyTypes = this.fc.resolvePropertyTypes(paramDecl.type);
        var initMap = this.getInitializers(paramDecl);
        this.emit('{');
        for (var i = 0; i < bp.elements.length; i++) {
            var elem = bp.elements[i];
            var propDecl = propertyTypes[base.ident(elem.name)];
            if (propDecl && propDecl.type)
                this.visit(propDecl.type);
            this.visit(elem.name);
            if (elem.initializer && initMap[base.ident(elem.name)]) {
                this.reportError(elem, 'cannot have both an inner and outer initializer');
            }
            var init = elem.initializer || initMap[base.ident(elem.name)];
            if (init) {
                this.emit(':');
                this.visit(init);
            }
            if (i + 1 < bp.elements.length)
                this.emit(',');
        }
        this.emit('}');
    };
    DeclarationTranspiler.prototype.getInitializers = function (paramDecl) {
        var res = {};
        if (!paramDecl.initializer)
            return res;
        if (paramDecl.initializer.kind !== ts.SyntaxKind.ObjectLiteralExpression) {
            this.reportError(paramDecl, 'initializers for named parameters must be object literals');
            return res;
        }
        for (var _i = 0, _a = paramDecl.initializer.properties; _i < _a.length; _i++) {
            var i = _a[_i];
            if (i.kind !== ts.SyntaxKind.PropertyAssignment) {
                this.reportError(i, 'named parameter initializers must be properties, got ' + i.kind);
                continue;
            }
            var ole = i;
            res[base.ident(ole.name)] = ole.initializer;
        }
        return res;
    };
    /**
     * Handles a function typedef-like interface, i.e. an interface that only declares a single
     * call signature, by translating to a Dart `typedef`.
     */
    DeclarationTranspiler.prototype.visitFunctionTypedefInterface = function (name, signature, typeParameters) {
        this.emit('typedef');
        if (signature.type) {
            this.visit(signature.type);
        }
        this.emit(name);
        if (typeParameters) {
            this.emit('<');
            this.visitList(typeParameters);
            this.emit('>');
        }
        this.visitParameters(signature.parameters);
        this.emit(';');
    };
    return DeclarationTranspiler;
}(base.TranspilerBase));
exports.__esModule = true;
exports["default"] = DeclarationTranspiler;

//# sourceMappingURL=declaration.js.map
