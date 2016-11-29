"use strict";
var fs = require('fs');
var path = require('path');
function mkdirP(p) {
    // Convert input path to absolute and then relative so that we always have relative path in the
    // end. This can be made simpler when path.isAbsolute is available in node v0.12.
    p = path.resolve(p);
    p = path.relative('', p);
    var pathToCreate = '';
    p.split(path.sep).forEach(function (dirName) {
        pathToCreate = path.join(pathToCreate, dirName);
        if (!fs.existsSync(pathToCreate)) {
            fs.mkdirSync(pathToCreate);
        }
    });
}
exports.__esModule = true;
exports["default"] = mkdirP;

//# sourceMappingURL=mkdirp.js.map
