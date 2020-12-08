"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var path = require('path');
var ts = require('typescript');
var base = require('./base');
var FACADE_DEBUG = false;
var DEFAULT_LIB_MARKER = '__ts2dart_default_lib';
var PROVIDER_IMPORT_MARKER = '__ts2dart_has_provider_import';
var TS2DART_PROVIDER_COMMENT = '@ts2dart_Provider';
function merge() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i - 0] = arguments[_i];
    }
    var returnObject = {};
    for (var _a = 0, args_1 = args; _a < args_1.length; _a++) {
        var arg = args_1[_a];
        for (var _b = 0, _c = Object.getOwnPropertyNames(arg); _b < _c.length; _b++) {
            var key = _c[_b];
            returnObject[key] = arg[key];
        }
    }
    return returnObject;
}
var FacadeConverter = (function (_super) {
    __extends(FacadeConverter, _super);
    function FacadeConverter(transpiler) {
        var _this = this;
        _super.call(this, transpiler);
        this.candidateProperties = {};
        this.candidateTypes = {};
        this.genericMethodDeclDepth = 0;
        this.stdlibTypeReplacements = {
            'Date': 'DateTime',
            'Array': 'List',
            'XMLHttpRequest': 'HttpRequest',
            'Uint8Array': 'Uint8List',
            'ArrayBuffer': 'ByteBuffer',
            'Promise': 'Future',
            'undefined': 'null',
            'replace': 'replaceFirst',
            'require': 'HttpRequest.getString',
            'then': 'then',
            'Object': 'Map',
            'parseFloat': 'double.parse',
            'parseInt': 'int.parse',
            'Math': 'Math',
            // Dart has two different incompatible DOM APIs
            // https://github.com/angular/angular/issues/2770
            'Node': 'dynamic',
            'Text': 'dynamic',
            'Element': 'dynamic',
            'Event': 'dynamic',
            'HTMLElement': 'dynamic',
            'HTMLAnchorElement': 'dynamic',
            'HTMLStyleElement': 'dynamic',
            'HTMLInputElement': 'dynamic',
            'HTMLDocument': 'dynamic',
            'History': 'dynamic',
            'Location': 'dynamic'
        };
        this.tsToDartTypeNames = (_a = {},
            _a[DEFAULT_LIB_MARKER] = this.stdlibTypeReplacements,
            _a['angular2/src/facade/lang'] = { 'Date': 'DateTime' },
            _a['rxjs/Observable'] = { 'Observable': 'Stream' },
            _a['es6-promise/es6-promise'] = { 'Promise': 'Future' },
            _a['es6-shim/es6-shim'] = { 'Promise': 'Future' },
            _a
        );
        this.es6Promises = {
            'Promise.catch': function (c, context) {
                _this.visit(context);
                _this.emit('.catchError(');
                _this.visitList(c.arguments);
                _this.emit(')');
            },
            'Promise.then': function (c, context) {
                // then() in Dart doesn't support 2 arguments.
                _this.visit(context);
                _this.emit('.then(');
                _this.visit(c.arguments[0]);
                _this.emit(')');
                if (c.arguments.length > 1) {
                    _this.emit('.catchError(');
                    _this.visit(c.arguments[1]);
                    _this.emit(')');
                }
            },
            'Promise': function (c, context) {
                if (c.kind !== ts.SyntaxKind.NewExpression)
                    return true;
                _this.assert(c, c.arguments.length === 1, 'Promise construction must take 2 arguments.');
                _this.assert(c, c.arguments[0].kind === ts.SyntaxKind.ArrowFunction ||
                    c.arguments[0].kind === ts.SyntaxKind.FunctionExpression, 'Promise argument must be a function expression (or arrow function).');
                var callback;
                if (c.arguments[0].kind === ts.SyntaxKind.ArrowFunction) {
                    callback = c.arguments[0];
                }
                else if (c.arguments[0].kind === ts.SyntaxKind.FunctionExpression) {
                    callback = c.arguments[0];
                }
                _this.assert(c, callback.parameters.length > 0 && callback.parameters.length < 3, 'Promise executor must take 1 or 2 arguments (resolve and reject).');
                var completerVarName = _this.uniqueId('completer');
                _this.assert(c, callback.parameters[0].name.kind === ts.SyntaxKind.Identifier, 'First argument of the Promise executor is not a straight parameter.');
                var resolveParameterIdent = (callback.parameters[0].name);
                _this.emit('(() {'); // Create a new scope.
                _this.emit("Completer " + completerVarName + " = new Completer();");
                _this.emit('var');
                _this.emit(resolveParameterIdent.text);
                _this.emit("= " + completerVarName + ".complete;");
                if (callback.parameters.length === 2) {
                    _this.assert(c, callback.parameters[1].name.kind === ts.SyntaxKind.Identifier, 'First argument of the Promise executor is not a straight parameter.');
                    var rejectParameterIdent = (callback.parameters[1].name);
                    _this.emit('var');
                    _this.emit(rejectParameterIdent.text);
                    _this.emit("= " + completerVarName + ".completeError;");
                }
                _this.emit('(()');
                _this.visit(callback.body);
                _this.emit(')();');
                _this.emit("return " + completerVarName + ".future;");
                _this.emit('})()');
            }
        };
        this.es6Collections = {
            'Map.set': function (c, context) {
                _this.visit(context);
                _this.emit('[');
                _this.visit(c.arguments[0]);
                _this.emit(']');
                _this.emit('=');
                _this.visit(c.arguments[1]);
            },
            'Map.get': function (c, context) {
                _this.visit(context);
                _this.emit('[');
                _this.visit(c.arguments[0]);
                _this.emit(']');
            },
            'Map.has': function (c, context) {
                _this.visit(context);
                _this.emitMethodCall('containsKey', c.arguments);
            },
            'Map.delete': function (c, context) {
                // JS Map.delete(k) returns whether k was present in the map,
                // convert to:
                // (Map.containsKey(k) && (Map.remove(k) !== null || true))
                // (Map.remove(k) !== null || true) is required to always returns true
                // when Map.containsKey(k)
                _this.emit('(');
                _this.visit(context);
                _this.emitMethodCall('containsKey', c.arguments);
                _this.emit('&& (');
                _this.visit(context);
                _this.emitMethodCall('remove', c.arguments);
                _this.emit('!= null || true ) )');
            },
            'Map.forEach': function (c, context) {
                var cb;
                var params;
                switch (c.arguments[0].kind) {
                    case ts.SyntaxKind.FunctionExpression:
                        cb = (c.arguments[0]);
                        params = cb.parameters;
                        if (params.length !== 2) {
                            _this.reportError(c, 'Map.forEach callback requires exactly two arguments');
                            return;
                        }
                        _this.visit(context);
                        _this.emit('. forEach ( (');
                        _this.visit(params[1]);
                        _this.emit(',');
                        _this.visit(params[0]);
                        _this.emit(')');
                        _this.visit(cb.body);
                        _this.emit(')');
                        break;
                    case ts.SyntaxKind.ArrowFunction:
                        cb = (c.arguments[0]);
                        params = cb.parameters;
                        if (params.length !== 2) {
                            _this.reportError(c, 'Map.forEach callback requires exactly two arguments');
                            return;
                        }
                        _this.visit(context);
                        _this.emit('. forEach ( (');
                        _this.visit(params[1]);
                        _this.emit(',');
                        _this.visit(params[0]);
                        _this.emit(')');
                        if (cb.body.kind !== ts.SyntaxKind.Block) {
                            _this.emit('=>');
                        }
                        _this.visit(cb.body);
                        _this.emit(')');
                        break;
                    default:
                        _this.visit(context);
                        _this.emit('. forEach ( ( k , v ) => (');
                        _this.visit(c.arguments[0]);
                        _this.emit(') ( v , k ) )');
                        break;
                }
            },
            'Array.find': function (c, context) {
                _this.visit(context);
                _this.emit('. firstWhere (');
                _this.visit(c.arguments[0]);
                _this.emit(', orElse : ( ) => null )');
            }
        };
        this.stdlibHandlers = merge(this.es6Promises, this.es6Collections, {
            'Array.push': function (c, context) {
                _this.visit(context);
                _this.emitMethodCall('add', c.arguments);
            },
            'Array.pop': function (c, context) {
                _this.visit(context);
                _this.emitMethodCall('removeLast');
            },
            'Array.shift': function (c, context) {
                _this.visit(context);
                _this.emit('. removeAt ( 0 )');
            },
            'Array.unshift': function (c, context) {
                _this.emit('(');
                _this.visit(context);
                if (c.arguments.length === 1) {
                    _this.emit('.. insert ( 0,');
                    _this.visit(c.arguments[0]);
                    _this.emit(') ) . length');
                }
                else {
                    _this.emit('.. insertAll ( 0, [');
                    _this.visitList(c.arguments);
                    _this.emit(']) ) . length');
                }
            },
            'Array.map': function (c, context) {
                _this.visit(context);
                _this.emitMethodCall('map', c.arguments);
                _this.emitMethodCall('toList');
            },
            'Array.filter': function (c, context) {
                _this.visit(context);
                _this.emitMethodCall('where', c.arguments);
                _this.emitMethodCall('toList');
            },
            'Array.some': function (c, context) {
                _this.visit(context);
                _this.emitMethodCall('any', c.arguments);
            },
            'Array.slice': function (c, context) {
                _this.emitCall('ListWrapper.slice', [context].concat(c.arguments));
            },
            'Array.splice': function (c, context) {
                _this.emitCall('ListWrapper.splice', [context].concat(c.arguments));
            },
            'Array.concat': function (c, context) {
                _this.emit('( new List . from (');
                _this.visit(context);
                _this.emit(')');
                c.arguments.forEach(function (arg) {
                    if (!_this.isNamedDefaultLibType(arg, 'Array')) {
                        _this.reportError(arg, 'Array.concat only takes Array arguments');
                    }
                    _this.emit('.. addAll (');
                    _this.visit(arg);
                    _this.emit(')');
                });
                _this.emit(')');
            },
            'Array.join': function (c, context) {
                _this.visit(context);
                if (c.arguments.length) {
                    _this.emitMethodCall('join', c.arguments);
                }
                else {
                    _this.emit('. join ( "," )');
                }
            },
            'Array.reduce': function (c, context) {
                _this.visit(context);
                if (c.arguments.length >= 2) {
                    _this.emitMethodCall('fold', [c.arguments[1], c.arguments[0]]);
                }
                else {
                    _this.emit('. fold ( null ,');
                    _this.visit(c.arguments[0]);
                    _this.emit(')');
                }
            },
            'ArrayConstructor.isArray': function (c, context) {
                _this.emit('( (');
                _this.visitList(c.arguments); // Should only be 1.
                _this.emit(')');
                _this.emit('is List');
                _this.emit(')');
            },
            'Console.log': function (c, context) {
                _this.emit('print(');
                if (c.arguments.length === 1) {
                    _this.visit(c.arguments[0]);
                }
                else {
                    _this.emit('[');
                    _this.visitList(c.arguments);
                    _this.emit('].join(" ")');
                }
                _this.emit(')');
            },
            'RegExp.exec': function (c, context) {
                if (context.kind !== ts.SyntaxKind.RegularExpressionLiteral) {
                    // Fail if the exec call isn't made directly on a regexp literal.
                    // Multiple exec calls on the same global regexp have side effects
                    // (each return the next match), which we can't reproduce with a simple
                    // Dart RegExp (users should switch to some facade / wrapper instead).
                    _this.reportError(c, 'exec is only supported on regexp literals, ' +
                        'to avoid side-effect of multiple calls on global regexps.');
                }
                if (c.parent.kind === ts.SyntaxKind.ElementAccessExpression) {
                    // The result of the exec call is used for immediate indexed access:
                    // this use-case can be accommodated by RegExp.firstMatch, which returns
                    // a Match instance with operator[] which returns groups (special index
                    // 0 returns the full text of the match).
                    _this.visit(context);
                    _this.emitMethodCall('firstMatch', c.arguments);
                }
                else {
                    // In the general case, we want to return a List. To transform a Match
                    // into a List of its groups, we alias it in a local closure that we
                    // call with the Match value. We are then able to use the group method
                    // to generate a List large enough to hold groupCount groups + the
                    // full text of the match at special group index 0.
                    _this.emit('((match) => new List.generate(1 + match.groupCount, match.group))(');
                    _this.visit(context);
                    _this.emitMethodCall('firstMatch', c.arguments);
                    _this.emit(')');
                }
            },
            'RegExp.test': function (c, context) {
                _this.visit(context);
                _this.emitMethodCall('hasMatch', c.arguments);
            },
            'String.substr': function (c, context) {
                _this.reportError(c, 'substr is unsupported, use substring (but beware of the different semantics!)');
                _this.visit(context);
                _this.emitMethodCall('substr', c.arguments);
            }
        });
        this.callHandlerReplaceNew = (_b = {},
            _b[DEFAULT_LIB_MARKER] = { 'Promise': true },
            _b
        );
        this.callHandlers = (_c = {},
            _c[DEFAULT_LIB_MARKER] = this.stdlibHandlers,
            _c['angular2/manual_typings/globals'] = this.es6Collections,
            _c['angular2/src/facade/collection'] = {
                'Map': function (c, context) {
                    // The actual Map constructor is special cased for const calls.
                    if (!_this.isInsideConstExpr(c))
                        return true;
                    if (c.arguments.length) {
                        _this.reportError(c, 'Arguments on a Map constructor in a const are unsupported');
                    }
                    if (c.typeArguments) {
                        _this.emit('<');
                        _this.visitList(c.typeArguments);
                        _this.emit('>');
                    }
                    _this.emit('{ }');
                    return false;
                }
            },
            _c['angular2/src/core/di/forward_ref'] = {
                'forwardRef': function (c, context) {
                    // The special function forwardRef translates to an unwrapped value in Dart.
                    var callback = c.arguments[0];
                    if (callback.kind !== ts.SyntaxKind.ArrowFunction) {
                        _this.reportError(c, 'forwardRef takes only arrow functions');
                        return;
                    }
                    _this.visit(callback.body);
                }
            },
            _c['angular2/src/facade/lang'] = {
                'CONST_EXPR': function (c, context) {
                    // `const` keyword is emitted in the array literal handling, as it needs to be transitive.
                    _this.visitList(c.arguments);
                },
                'normalizeBlank': function (c, context) {
                    // normalizeBlank is a noop in Dart, so erase it.
                    _this.visitList(c.arguments);
                }
            },
            _c
        );
        this.es6CollectionsProp = {
            'Map.size': function (p) {
                _this.visit(p.expression);
                _this.emit('.');
                _this.emit('length');
            }
        };
        this.es6PromisesProp = {
            'PromiseConstructor.resolve': function (p) {
                _this.emit('new ');
                _this.visit(p.expression);
                _this.emit('.value');
            },
            'PromiseConstructor.reject': function (p) {
                _this.emit('new ');
                _this.visit(p.expression);
                _this.emit('.error');
            }
        };
        this.propertyHandlers = (_d = {},
            _d[DEFAULT_LIB_MARKER] = merge(this.es6CollectionsProp, this.es6PromisesProp),
            _d
        );
        this.extractPropertyNames(this.callHandlers, this.candidateProperties);
        this.extractPropertyNames(this.propertyHandlers, this.candidateProperties);
        this.extractPropertyNames(this.tsToDartTypeNames, this.candidateTypes);
        var _a, _b, _c, _d;
    }
    FacadeConverter.prototype.initializeTypeBasedConversion = function (tc, opts, host) {
        this.tc = tc;
        this.defaultLibLocation = ts.getDefaultLibFilePath(opts).replace(/\.d\.ts$/, '');
        this.resolveModuleNames(opts, host, this.callHandlers);
        this.resolveModuleNames(opts, host, this.propertyHandlers);
        this.resolveModuleNames(opts, host, this.tsToDartTypeNames);
        this.resolveModuleNames(opts, host, this.callHandlerReplaceNew);
    };
    FacadeConverter.prototype.extractPropertyNames = function (m, candidates) {
        for (var _i = 0, _a = Object.keys(m); _i < _a.length; _i++) {
            var fileName = _a[_i];
            var file = m[fileName];
            Object.keys(file)
                .map(function (propName) { return propName.substring(propName.lastIndexOf('.') + 1); })
                .forEach(function (propName) { return candidates[propName] = true; });
        }
    };
    FacadeConverter.prototype.resolveModuleNames = function (opts, host, m) {
        for (var _i = 0, _a = Object.keys(m); _i < _a.length; _i++) {
            var mn = _a[_i];
            var actual = void 0;
            var absolute = void 0;
            if (mn === DEFAULT_LIB_MARKER) {
                actual = this.defaultLibLocation;
            }
            else {
                var resolved = ts.resolveModuleName(mn, '', opts, host);
                if (!resolved.resolvedModule)
                    continue;
                actual = resolved.resolvedModule.resolvedFileName.replace(/(\.d)?\.ts$/, '');
                // TypeScript's resolution returns relative paths here, but uses absolute ones in
                // SourceFile.fileName later. Make sure to hit both use cases.
                absolute = path.resolve(actual);
            }
            if (FACADE_DEBUG)
                console.log('Resolved module', mn, '->', actual);
            m[actual] = m[mn];
            if (absolute)
                m[absolute] = m[mn];
        }
    };
    /**
     * To avoid strongly referencing the Provider class (which could bloat binary size), Angular 2
     * write providers as object literals. However the Dart transformers don't recognize this, so
     * ts2dart translates the special syntax `/* @ts2dart_Provider * / {provide: Class, param1: ...}`
     * into `const Provider(Class, param1: ...)`.
     */
    FacadeConverter.prototype.maybeHandleProvider = function (ole) {
        var _this = this;
        if (!this.hasMarkerComment(ole, TS2DART_PROVIDER_COMMENT))
            return false;
        var classParam;
        var remaining = ole.properties.filter(function (e) {
            if (e.kind !== ts.SyntaxKind.PropertyAssignment) {
                _this.reportError(e, TS2DART_PROVIDER_COMMENT + ' elements must be property assignments');
            }
            if ('provide' === base.ident(e.name)) {
                classParam = e.initializer;
                return false;
            }
            return true; // include below.
        });
        if (!classParam) {
            this.reportError(ole, 'missing provide: element');
            return false;
        }
        this.emit('const Provider(');
        this.visit(classParam);
        if (remaining.length > 0) {
            this.emit(',');
            for (var i = 0; i < remaining.length; i++) {
                var e = remaining[i];
                if (e.kind !== ts.SyntaxKind.PropertyAssignment)
                    this.visit(e.name);
                this.emit(base.ident(e.name));
                this.emit(':');
                this.visit(e.initializer);
                if ((i + 1) < remaining.length)
                    this.emit(',');
            }
            this.emit(')');
        }
        return true;
    };
    FacadeConverter.prototype.maybeHandleCall = function (c) {
        if (!this.tc)
            return false;
        var _a = this.getCallInformation(c), context = _a.context, symbol = _a.symbol;
        if (!symbol) {
            // getCallInformation returns a symbol if we understand this call.
            return false;
        }
        var handler = this.getHandler(c, symbol, this.callHandlers);
        return handler && !handler(c, context);
    };
    FacadeConverter.prototype.handlePropertyAccess = function (pa) {
        if (!this.tc)
            return;
        var ident = pa.name.text;
        if (!this.candidateProperties.hasOwnProperty(ident))
            return false;
        var symbol = this.tc.getSymbolAtLocation(pa.name);
        if (!symbol) {
            if (!this.stdlibTypeReplacements[ident]) {
                this.reportMissingType(pa, ident);
            }
            return false;
        }
        var handler = this.getHandler(pa, symbol, this.propertyHandlers);
        return handler && !handler(pa);
    };
    /**
     * Searches for type references that require extra imports and emits the imports as necessary.
     */
    FacadeConverter.prototype.emitExtraImports = function (sourceFile) {
        var libraries = {
            'XMLHttpRequest': 'dart:html',
            'KeyboardEvent': 'dart:html',
            'Uint8Array': 'dart:typed_arrays',
            'ArrayBuffer': 'dart:typed_arrays',
            'Promise': 'dart:async',
            'HttpRequest.getString': 'dart:html'
        };
        var emitted = {};
        this.emitImports(sourceFile, libraries, emitted, sourceFile);
    };
    FacadeConverter.prototype.emitImports = function (n, libraries, emitted, sourceFile) {
        var _this = this;
        if (n.kind === ts.SyntaxKind.TypeReference) {
            var type = base.ident(n.typeName);
            if (libraries.hasOwnProperty(type)) {
                var toEmit = libraries[type];
                if (!emitted[toEmit]) {
                    this.emit("import '" + toEmit + "';");
                    emitted[toEmit] = true;
                }
            }
        }
        // Support for importing "Provider" in case /* @ts2dart_Provider */ comments are present.
        if (n.kind === ts.SyntaxKind.ImportDeclaration) {
            // See if there is already code importing 'Provider' from angular2/core.
            var id = n;
            if (id.moduleSpecifier.text === 'angular2/core') {
                if (id.importClause.namedBindings.kind === ts.SyntaxKind.NamedImports) {
                    var ni = id.importClause.namedBindings;
                    for (var _i = 0, _a = ni.elements; _i < _a.length; _i++) {
                        var nb = _a[_i];
                        if (base.ident(nb.name) === 'Provider') {
                            emitted[PROVIDER_IMPORT_MARKER] = true;
                            break;
                        }
                    }
                }
            }
        }
        if (!emitted[PROVIDER_IMPORT_MARKER] && this.hasMarkerComment(n, TS2DART_PROVIDER_COMMENT)) {
            // if 'Provider' has not been imported yet, and there's a @ts2dart_Provider, add it.
            this.emit("import \"package:angular2/core.dart\" show Provider;");
            emitted[PROVIDER_IMPORT_MARKER] = true;
        }
        n.getChildren(sourceFile)
            .forEach(function (child) { return _this.emitImports(child, libraries, emitted, sourceFile); });
    };
    FacadeConverter.prototype.pushTypeParameterNames = function (n) {
        if (!n.typeParameters)
            return;
        this.genericMethodDeclDepth++;
    };
    FacadeConverter.prototype.popTypeParameterNames = function (n) {
        if (!n.typeParameters)
            return;
        this.genericMethodDeclDepth--;
    };
    FacadeConverter.prototype.resolvePropertyTypes = function (tn) {
        var res = {};
        if (!tn || !this.tc)
            return res;
        var t = this.tc.getTypeAtLocation(tn);
        for (var _i = 0, _a = this.tc.getPropertiesOfType(t); _i < _a.length; _i++) {
            var sym = _a[_i];
            var decl = sym.valueDeclaration || (sym.declarations && sym.declarations[0]);
            if (decl.kind !== ts.SyntaxKind.PropertyDeclaration &&
                decl.kind !== ts.SyntaxKind.PropertySignature) {
                var msg = this.tc.getFullyQualifiedName(sym) +
                    ' used for named parameter definition must be a property';
                this.reportError(decl, msg);
                continue;
            }
            res[sym.name] = decl;
        }
        return res;
    };
    /**
     * The Dart Development Compiler (DDC) has a syntax extension that uses comments to emulate
     * generic methods in Dart. ts2dart has to hack around this and keep track of which type names
     * in the current scope are actually DDC type parameters and need to be emitted in comments.
     *
     * TODO(martinprobst): Remove this once the DDC hack has made it into Dart proper.
     */
    FacadeConverter.prototype.isGenericMethodTypeParameterName = function (name) {
        // Avoid checking this unless needed.
        if (this.genericMethodDeclDepth === 0 || !this.tc)
            return false;
        // Check if the type of the name is a TypeParameter.
        var t = this.tc.getTypeAtLocation(name);
        if (!t || (t.flags & ts.TypeFlags.TypeParameter) === 0)
            return false;
        // Check if the symbol we're looking at is the type parameter.
        var symbol = this.tc.getSymbolAtLocation(name);
        if (symbol !== t.symbol)
            return false;
        // Check that the Type Parameter has been declared by a function declaration.
        return symbol.declarations.some(
        // Constructors are handled separately.
        function (d) { return d.parent.kind === ts.SyntaxKind.FunctionDeclaration ||
            d.parent.kind === ts.SyntaxKind.MethodDeclaration ||
            d.parent.kind === ts.SyntaxKind.MethodSignature; });
    };
    FacadeConverter.prototype.visitTypeName = function (typeName) {
        if (typeName.kind !== ts.SyntaxKind.Identifier) {
            this.visit(typeName);
            return;
        }
        var ident = base.ident(typeName);
        if (this.isGenericMethodTypeParameterName(typeName)) {
            // DDC generic methods hack - all names that are type parameters to generic methods have to be
            // emitted in comments.
            this.emit('dynamic/*=');
            this.emit(ident);
            this.emit('*/');
            return;
        }
        if (this.candidateTypes.hasOwnProperty(ident) && this.tc) {
            var symbol = this.tc.getSymbolAtLocation(typeName);
            if (!symbol) {
                if (!this.stdlibTypeReplacements[ident]) {
                    this.reportMissingType(typeName, ident);
                }
                else {
                    this.emit(this.stdlibTypeReplacements[ident]);
                    if (ident == 'require') {
                        this.emitBefore('import \'dart:html\';', 'import');
                    }
                    else if (ident == 'Math') {
                        this.emitBefore('import \'dart:math\' as Math;', 'import');
                    }
                }
                return;
            }
            if (this.stdlibTypeReplacements[ident]) {
                this.emit(this.stdlibTypeReplacements[ident]);
                return;
            }
            var fileAndName = this.getFileAndName(typeName, symbol);
            if (fileAndName) {
                var fileSubs = this.tsToDartTypeNames[fileAndName.fileName];
                if (fileSubs && fileSubs.hasOwnProperty(fileAndName.qname)) {
                    this.emit(fileSubs[fileAndName.qname]);
                    return;
                }
            }
        }
        this.emit(ident);
    };
    FacadeConverter.prototype.shouldEmitNew = function (c) {
        if (!this.tc)
            return true;
        var ci = this.getCallInformation(c);
        var symbol = ci.symbol;
        // getCallInformation returns a symbol if we understand this call.
        if (!symbol)
            return true;
        var loc = this.getFileAndName(c, symbol);
        if (!loc)
            return true;
        var fileName = loc.fileName, qname = loc.qname;
        var fileSubs = this.callHandlerReplaceNew[fileName];
        if (!fileSubs)
            return true;
        return !fileSubs[qname];
    };
    FacadeConverter.prototype.getCallInformation = function (c) {
        var symbol;
        var context;
        var ident;
        var expr = c.expression;
        if (expr.kind === ts.SyntaxKind.Identifier) {
            // Function call.
            ident = base.ident(expr);
            if (!this.candidateProperties.hasOwnProperty(ident))
                return {};
            symbol = this.tc.getSymbolAtLocation(expr);
            if (!symbol) {
                this.reportMissingType(c, ident);
                return {};
            }
            context = null;
        }
        else if (expr.kind === ts.SyntaxKind.PropertyAccessExpression) {
            // Method call.
            var pa = expr;
            ident = base.ident(pa.name);
            if (!this.candidateProperties.hasOwnProperty(ident))
                return {};
            symbol = this.tc.getSymbolAtLocation(pa);
            // Error will be reported by PropertyAccess handling below.
            if (!symbol)
                return {};
            context = pa.expression;
        }
        return { context: context, symbol: symbol };
    };
    FacadeConverter.prototype.getHandler = function (n, symbol, m) {
        var loc = this.getFileAndName(n, symbol);
        if (!loc)
            return null;
        var fileName = loc.fileName, qname = loc.qname;
        var fileSubs = m[fileName];
        if (!fileSubs)
            return null;
        return fileSubs[qname];
    };
    FacadeConverter.prototype.getFileAndName = function (n, originalSymbol) {
        var symbol = originalSymbol;
        while (symbol.flags & ts.SymbolFlags.Alias)
            symbol = this.tc.getAliasedSymbol(symbol);
        var decl = symbol.valueDeclaration;
        if (!decl) {
            // In the case of a pure declaration with no assignment, there is no value declared.
            // Just grab the first declaration, hoping it is declared once.
            if (!symbol.declarations || symbol.declarations.length === 0) {
                this.reportError(n, 'no declarations for symbol ' + originalSymbol.name);
                return null;
            }
            decl = symbol.declarations[0];
        }
        var canonicalFileName = decl.getSourceFile().fileName.replace(/(\.d)?\.ts$/, '');
        var qname = this.tc.getFullyQualifiedName(symbol);
        // Some Qualified Names include their file name. Might be a bug in TypeScript,
        // for the time being just special case.
        if (symbol.flags & (ts.SymbolFlags.Class | ts.SymbolFlags.Function | ts.SymbolFlags.Variable)) {
            qname = symbol.getName();
        }
        if (FACADE_DEBUG)
            console.error('cfn:', canonicalFileName, 'qn:', qname);
        return { fileName: canonicalFileName, qname: qname };
    };
    FacadeConverter.prototype.isNamedDefaultLibType = function (node, qname) {
        var symbol = this.tc.getTypeAtLocation(node).getSymbol();
        if (!symbol)
            return false;
        var actual = this.getFileAndName(node, symbol);
        return actual.fileName === this.defaultLibLocation && qname === actual.qname;
    };
    FacadeConverter.prototype.reportMissingType = function (n, ident) {
        this.reportError(n, ("Untyped property access to \"" + ident + "\" which could be ") +
            "a special ts2dart builtin. " +
            "Please add type declarations to disambiguate.");
    };
    FacadeConverter.prototype.isInsideConstExpr = function (node) {
        while (node.parent) {
            if (node.parent.kind === ts.SyntaxKind.Parameter &&
                node.parent.initializer === node) {
                // initializers of parameters must be const in Dart.
                return true;
            }
            if (this.isConstExpr(node))
                return true;
            node = node.parent;
            if (FacadeConverter.DECLARATIONS[node.kind]) {
                // Stop walking upwards when hitting a declaration - @ts2dart_const should only propagate
                // to the immediate declaration it applies to (but should be transitive in expressions).
                return false;
            }
        }
        return false;
    };
    FacadeConverter.prototype.isConstClass = function (decl) {
        var _this = this;
        return this.hasConstComment(decl) || this.hasAnnotation(decl.decorators, 'CONST') ||
            decl.members.some(function (m) {
                if (m.kind !== ts.SyntaxKind.Constructor)
                    return false;
                return _this.hasAnnotation(m.decorators, 'CONST');
            });
    };
    /**
     * isConstExpr returns true if the passed in expression itself is a const expression. const
     * expressions are marked by the special comment @ts2dart_const (expr), or by the special
     * function call CONST_EXPR.
     */
    FacadeConverter.prototype.isConstExpr = function (node) {
        if (!node)
            return false;
        if (this.hasConstComment(node)) {
            return true;
        }
        return node.kind === ts.SyntaxKind.CallExpression &&
            base.ident(node.expression) === 'CONST_EXPR';
    };
    FacadeConverter.prototype.hasConstComment = function (node) { return this.hasMarkerComment(node, '@ts2dart_const'); };
    FacadeConverter.prototype.hasMarkerComment = function (node, markerText) {
        var text = node.getFullText();
        var comments = ts.getLeadingCommentRanges(text, 0);
        if (!comments)
            return false;
        for (var _i = 0, comments_1 = comments; _i < comments_1.length; _i++) {
            var c = comments_1[_i];
            var commentText = text.substring(c.pos, c.end);
            if (commentText.indexOf(markerText) !== -1) {
                return true;
            }
        }
        return false;
    };
    FacadeConverter.prototype.emitMethodCall = function (name, args) {
        this.emit('.');
        this.emitCall(name, args);
    };
    FacadeConverter.prototype.emitCall = function (name, args) {
        this.emit(name);
        this.emit('(');
        if (args)
            this.visitList(args);
        this.emit(')');
    };
    FacadeConverter.DECLARATIONS = (_a = {},
        _a[ts.SyntaxKind.ClassDeclaration] = true,
        _a[ts.SyntaxKind.FunctionDeclaration] = true,
        _a[ts.SyntaxKind.InterfaceDeclaration] = true,
        _a[ts.SyntaxKind.MethodDeclaration] = true,
        _a[ts.SyntaxKind.PropertyDeclaration] = true,
        _a[ts.SyntaxKind.PropertyDeclaration] = true,
        _a[ts.SyntaxKind.VariableDeclaration] = true,
        _a
    );
    return FacadeConverter;
    var _a;
}(base.TranspilerBase));
exports.FacadeConverter = FacadeConverter;

//# sourceMappingURL=facade_converter.js.map
