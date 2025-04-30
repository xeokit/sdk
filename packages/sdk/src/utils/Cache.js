"use strict";
exports.__esModule = true;
exports.Cache = void 0;
var files = {};
var enabled = false;
var Cache = {
    enabled: false,
    files: {},
    add: function (key, file) {
        if (!enabled) {
            return;
        }
        files[key] = file;
    },
    get: function (key) {
        if (!enabled) {
            return;
        }
        return files[key];
    },
    remove: function (key) {
        delete files[key];
    },
    clear: function () {
        this.files = {};
    }
};
exports.Cache = Cache;
