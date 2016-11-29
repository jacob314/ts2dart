#! /usr/bin/env node
"use strict";
require('source-map-support').install();
var source_map_1 = require('source-map');
var fs = require('fs');
var path = require('path');
var ts = require('typescript');
var mkdirp_1 = require('./mkdirp');
var call_1 = require('./call');
var declaration_1 = require('./declaration');
var expression_1 = require('./expression');
var module_1 = require('./module');
var statement_1 = require('./statement');
var type_1 = require('./type');
var literal_1 = require('./literal');
var facade_converter_1 = require('./facade_converter');
var dartStyle = require('dart-style');
exports.COMPILER_OPTIONS = {
    allowNonTsExtensions: true,
    experimentalDecorators: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES6
};
var Transpiler = (function () {
    function Transpiler(options) {
        if (options === void 0) { options = {}; }
        this.options = options;
        // Comments attach to all following AST nodes before the next 'physical' token. Track the earliest
        // offset to avoid printing comments multiple times.
        this.lastCommentIdx = -1;
        this.errors = [];
        // TODO: Remove the angular2 default when angular uses typingsRoot.
        this.fc = new facade_converter_1.FacadeConverter(this);
        this.transpilers = [
            new call_1["default"](this, this.fc),
            new declaration_1["default"](this, this.fc, options.enforceUnderscoreConventions),
            new expression_1["default"](this, this.fc),
            new literal_1["default"](this, this.fc),
            new module_1["default"](this, this.fc, options.generateLibraryName),
            new statement_1["default"](this),
            new type_1["default"](this, this.fc),
        ];
    }
    /**
     * Transpiles the given files to Dart.
     * @param fileNames The input files.
     * @param destination Location to write files to. Creates files next to their sources if absent.
     */
    Transpiler.prototype.transpile = function (fileNames, destination) {
        var _this = this;
        if (this.options.basePath) {
            this.options.basePath = this.normalizeSlashes(path.resolve(this.options.basePath));
        }
        fileNames = fileNames.map(function (f) { return _this.normalizeSlashes(path.resolve(f)); });
        var host;
        var compilerOpts;
        if (this.options.tsconfig) {
            var _a = ts.readConfigFile(this.options.tsconfig, function (f) { return fs.readFileSync(f, 'utf-8'); }), config = _a.config, error = _a.error;
            if (error)
                throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
            var _b = ts.convertCompilerOptionsFromJson(config.compilerOptions, path.dirname(this.options.tsconfig)), options = _b.options, errors = _b.errors;
            if (errors && errors.length) {
                throw new Error(errors.map(function (d) { return _this.diagnosticToString(d); }).join('\n'));
            }
            host = ts.createCompilerHost(options, /*setParentNodes*/ true);
            compilerOpts = options;
            if (compilerOpts.rootDir != null && this.options.basePath == null) {
                // Use the tsconfig's rootDir if basePath is not set.
                this.options.basePath = compilerOpts.rootDir;
            }
            if (compilerOpts.outDir != null && destination == null) {
                destination = compilerOpts.outDir;
            }
        }
        else {
            host = this.createCompilerHost();
            compilerOpts = this.getCompilerOptions();
        }
        if (this.options.basePath)
            this.options.basePath = path.resolve(this.options.basePath);
        if (this.options.basePath && destination === undefined) {
            throw new Error('Must have a destination path when a basePath is specified ' + this.options.basePath);
        }
        var destinationRoot = destination || this.options.basePath || '';
        var program = ts.createProgram(fileNames, compilerOpts, host);
        if (this.options.translateBuiltins) {
            this.fc.initializeTypeBasedConversion(program.getTypeChecker(), compilerOpts, host);
        }
        // Only write files that were explicitly passed in.
        var fileSet = {};
        fileNames.forEach(function (f) { return fileSet[f] = true; });
        this.errors = [];
        program.getSourceFiles()
            .filter(function (sourceFile) { return fileSet[sourceFile.fileName]; })
            .filter(function (sourceFile) { return !sourceFile.fileName.match(/\.d\.ts$/); })
            .forEach(function (f) {
            var dartCode = _this.translate(f);
            var outputFile = _this.getOutputPath(f.fileName, destinationRoot)
                .replace(/([A-Z])/g, function ($1) { return "_" + $1.toLowerCase(); });
            if (outputFile.charAt(0) == '_')
                outputFile = outputFile.substring(1);
            mkdirp_1["default"](path.dirname(outputFile));
            console.log(dartCode);
            fs.writeFileSync(outputFile, dartCode);
        });
        this.checkForErrors(program);
    };
    Transpiler.prototype.translateProgram = function (program, host) {
        var _this = this;
        if (this.options.translateBuiltins) {
            this.fc.initializeTypeBasedConversion(program.getTypeChecker(), program.getCompilerOptions(), host);
        }
        var paths = {};
        this.errors = [];
        program.getSourceFiles()
            .filter(function (sourceFile) {
            return (!sourceFile.fileName.match(/\.d\.ts$/) && !!sourceFile.fileName.match(/\.[jt]s$/));
        })
            .forEach(function (f) { return paths[f.fileName] = _this.translate(f); });
        this.checkForErrors(program);
        return paths;
    };
    Transpiler.prototype.getCompilerOptions = function () {
        var opts = {};
        for (var _i = 0, _a = Object.keys(exports.COMPILER_OPTIONS); _i < _a.length; _i++) {
            var k = _a[_i];
            opts[k] = exports.COMPILER_OPTIONS[k];
        }
        opts.rootDir = this.options.basePath;
        return opts;
    };
    Transpiler.prototype.createCompilerHost = function () {
        var defaultLibFileName = ts.getDefaultLibFileName(exports.COMPILER_OPTIONS);
        defaultLibFileName = this.normalizeSlashes(defaultLibFileName);
        var compilerHost = {
            getSourceFile: function (sourceName, languageVersion) {
                var sourcePath = sourceName;
                if (sourceName === defaultLibFileName) {
                    sourcePath = ts.getDefaultLibFilePath(exports.COMPILER_OPTIONS);
                }
                if (!fs.existsSync(sourcePath))
                    return undefined;
                var contents = fs.readFileSync(sourcePath, 'UTF-8');
                return ts.createSourceFile(sourceName, contents, exports.COMPILER_OPTIONS.target, true);
            },
            writeFile: function (name, text, writeByteOrderMark) { fs.writeFile(name, text); },
            fileExists: function (filename) { return fs.existsSync(filename); },
            readFile: function (filename) { return fs.readFileSync(filename, 'utf-8'); },
            getDefaultLibFileName: function () { return defaultLibFileName; },
            useCaseSensitiveFileNames: function () { return true; },
            getCanonicalFileName: function (filename) { return filename; },
            getCurrentDirectory: function () { return ''; },
            getNewLine: function () { return '\n'; }
        };
        compilerHost.resolveModuleNames = getModuleResolver(compilerHost);
        return compilerHost;
    };
    // Visible for testing.
    Transpiler.prototype.getOutputPath = function (filePath, destinationRoot) {
        var relative = this.getRelativeFileName(filePath);
        var dartFile = relative.replace(/.(js|es6|ts)$/, '.dart');
        return this.normalizeSlashes(path.join(destinationRoot, dartFile));
    };
    Transpiler.prototype.translate = function (sourceFile) {
        this.currentFile = sourceFile;
        this.output = new Output(sourceFile, this.getRelativeFileName(sourceFile.fileName), this.options.generateSourceMap);
        this.lastCommentIdx = -1;
        this.visit(sourceFile);
        var result = this.output.getResult();
        return this.formatCode(result, sourceFile);
    };
    Transpiler.prototype.formatCode = function (code, context) {
        var result = dartStyle.formatCode(code);
        if (result.error) {
            this.reportError(context, result.error);
        }
        return result.code;
    };
    Transpiler.prototype.checkForErrors = function (program) {
        var _this = this;
        var errors = this.errors;
        var diagnostics = program.getGlobalDiagnostics().concat(program.getSyntacticDiagnostics());
        if ((errors.length || diagnostics.length) && this.options.translateBuiltins) {
            // Only report semantic diagnostics if ts2dart failed; this code is not a generic compiler, so
            // only yields TS errors if they could be the cause of ts2dart issues.
            // This greatly speeds up tests and execution.
            diagnostics = diagnostics.concat(program.getSemanticDiagnostics());
        }
        var diagnosticErrs = diagnostics.map(function (d) { return _this.diagnosticToString(d); });
        if (diagnosticErrs.length)
            errors = errors.concat(diagnosticErrs);
        if (errors.length) {
            var e = new Error(errors.join('\n'));
            e.name = 'TS2DartError';
            throw e;
        }
    };
    Transpiler.prototype.diagnosticToString = function (diagnostic) {
        var msg = '';
        if (diagnostic.file) {
            var pos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            var fn = this.getRelativeFileName(diagnostic.file.fileName);
            msg += " " + fn + ":" + (pos.line + 1) + ":" + (pos.character + 1);
        }
        msg += ': ';
        msg += ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        return msg;
    };
    /**
     * Returns `filePath`, relativized to the program's `basePath`.
     * @param filePath path to relativize.
     */
    Transpiler.prototype.getRelativeFileName = function (filePath) {
        var base = this.options.basePath || '';
        if (filePath[0] === '/' && filePath.indexOf(base) !== 0 && !filePath.match(/\.d\.ts$/)) {
            throw new Error("Files must be located under base, got " + filePath + " vs " + base);
        }
        var rel = path.relative(base, filePath);
        if (rel.indexOf('../') === 0) {
            // filePath is outside of rel, just use it directly.
            rel = filePath;
        }
        return this.normalizeSlashes(rel);
    };
    Transpiler.prototype.emit = function (s) { this.output.emit(s); };
    Transpiler.prototype.emitBefore = function (s, search) { this.output.emitBefore(s, search); };
    Transpiler.prototype.emitNoSpace = function (s) { this.output.emitNoSpace(s); };
    Transpiler.prototype.reportError = function (n, message) {
        var file = n.getSourceFile() || this.currentFile;
        var fileName = this.getRelativeFileName(file.fileName);
        var start = n.getStart(file);
        var pos = file.getLineAndCharacterOfPosition(start);
        // Line and character are 0-based.
        var fullMessage = fileName + ":" + (pos.line + 1) + ":" + (pos.character + 1) + ": " + message;
        if (this.options.failFast)
            throw new Error(fullMessage);
        this.errors.push(fullMessage);
    };
    Transpiler.prototype.visit = function (node) {
        var _this = this;
        this.output.addSourceMapping(node);
        try {
            var comments = ts.getLeadingCommentRanges(this.currentFile.text, node.getFullStart());
            if (comments) {
                comments.forEach(function (c) {
                    if (c.pos <= _this.lastCommentIdx)
                        return;
                    _this.lastCommentIdx = c.pos;
                    var text = _this.currentFile.text.substring(c.pos, c.end);
                    _this.emitNoSpace('\n');
                    _this.emit(_this.translateComment(text));
                    if (c.hasTrailingNewLine)
                        _this.emitNoSpace('\n');
                });
            }
            for (var i = 0; i < this.transpilers.length; i++) {
                if (this.transpilers[i].visitNode(node))
                    return;
            }
            this.reportError(node, "Unsupported node type " + ts.SyntaxKind[node.kind] + ": " + node.getFullText());
        }
        catch (e) {
            this.reportError(node, 'ts2dart crashed ' + e.stack);
        }
    };
    Transpiler.prototype.normalizeSlashes = function (path) { return path.replace(/\\/g, '/'); };
    Transpiler.prototype.translateComment = function (comment) {
        comment = comment.replace(/\{@link ([^\}]+)\}/g, '[$1]');
        // Remove the following tags and following comments till end of line.
        comment = comment.replace(/@param.*$/gm, '');
        comment = comment.replace(/@throws.*$/gm, '');
        comment = comment.replace(/@return.*$/gm, '');
        // Remove the following tags.
        comment = comment.replace(/@module/g, '');
        comment = comment.replace(/@description/g, '');
        comment = comment.replace(/@deprecated/g, '');
        return comment;
    };
    return Transpiler;
}());
exports.Transpiler = Transpiler;
function getModuleResolver(compilerHost) {
    return function (moduleNames, containingFile) {
        var res = [];
        for (var _i = 0, moduleNames_1 = moduleNames; _i < moduleNames_1.length; _i++) {
            var mod = moduleNames_1[_i];
            var lookupRes = ts.nodeModuleNameResolver(mod, containingFile, exports.COMPILER_OPTIONS, compilerHost);
            if (lookupRes.resolvedModule) {
                res.push(lookupRes.resolvedModule);
                continue;
            }
            lookupRes = ts.classicNameResolver(mod, containingFile, exports.COMPILER_OPTIONS, compilerHost);
            if (lookupRes.resolvedModule) {
                res.push(lookupRes.resolvedModule);
                continue;
            }
            res.push(undefined);
        }
        return res;
    };
}
exports.getModuleResolver = getModuleResolver;
var Output = (function () {
    function Output(currentFile, relativeFileName, generateSourceMap) {
        this.currentFile = currentFile;
        this.relativeFileName = relativeFileName;
        this.result = '';
        this.column = 1;
        this.line = 1;
        if (generateSourceMap) {
            this.sourceMap = new source_map_1.SourceMapGenerator({ file: relativeFileName + '.dart' });
            this.sourceMap.setSourceContent(relativeFileName, this.currentFile.text);
        }
    }
    Output.prototype.emit = function (str) {
        this.emitNoSpace(' ');
        this.emitNoSpace(str);
    };
    Output.prototype.emitBefore = function (str, search) {
        var idx = this.result.indexOf(search);
        if (idx < 0)
            return;
        str = str + ' ';
        this.result = this.result.substring(0, idx) + str + this.result.substring(idx);
        for (var i = 0; i < str.length; i++) {
            if (str[i] === '\n') {
                this.line++;
                this.column = 0;
            }
            else {
                this.column++;
            }
        }
    };
    Output.prototype.emitNoSpace = function (str) {
        this.result += str;
        for (var i = 0; i < str.length; i++) {
            if (str[i] === '\n') {
                this.line++;
                this.column = 0;
            }
            else {
                this.column++;
            }
        }
    };
    Output.prototype.getResult = function () { return this.result + this.generateSourceMapComment(); };
    Output.prototype.addSourceMapping = function (n) {
        if (!this.generateSourceMap)
            return; // source maps disabled.
        var file = n.getSourceFile() || this.currentFile;
        var start = n.getStart(file);
        var pos = file.getLineAndCharacterOfPosition(start);
        var mapping = {
            original: { line: pos.line + 1, column: pos.character },
            generated: { line: this.line, column: this.column },
            source: this.relativeFileName
        };
        this.sourceMap.addMapping(mapping);
    };
    Output.prototype.generateSourceMapComment = function () {
        if (!this.sourceMap)
            return '';
        var base64map = new Buffer(JSON.stringify(this.sourceMap)).toString('base64');
        return '\n\n//# sourceMappingURL=data:application/json;base64,' + base64map;
    };
    return Output;
}());
function showHelp() {
    console.log("\nUsage: ts2dart [input-files] [arguments]\n\n  --help                            show this dialog\n  \n  --failFast                        Fail on the first error, do not collect multiple. Allows easier debugging \n                                    as stack traces lead directly to the offending line\n                          \n  --generateLibraryName             Whether to generate 'library a.b.c;' names from relative file paths.\n  \n  --generateSourceMap               Whether to generate source maps.\n  \n  --tsconfig                        A tsconfig.json to use to configure TypeScript compilation.\n  \n  --basePath                        A base path to relativize absolute file paths against. This\n                                    is useful for library name generation (see above) and nicer\n                                    file names in error messages.\n                          \n  --translateBuiltins               Translate calls to builtins, i.e. seemlessly convert from ` Array` to ` List`,\n                                    and convert the corresponding methods. Requires type checking.\n                                    \n  --enforceUnderscoreConventions    Enforce conventions of public/private keyword and underscore prefix\n");
    process.exit(0);
}
// CLI entry point
if (require.main === module) {
    var args = require('minimist')(process.argv.slice(2), { base: 'string' });
    if (args.help)
        showHelp();
    try {
        var transpiler = new Transpiler(args);
        console.error('Transpiling', args._, 'to', args.destination);
        transpiler.transpile(args._, args.destination);
    }
    catch (e) {
        if (e.name !== 'TS2DartError')
            throw e;
        console.error(e.message);
        process.exit(1);
    }
}

//# sourceMappingURL=main.js.map
