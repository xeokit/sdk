"use strict";
exports.__esModule = true;
exports.Loader = void 0;
var LoadingManager_1 = require("./LoadingManager");
var Loader = /** @class */ (function () {
    function Loader(manager) {
        this.manager = (manager !== undefined) ? manager : LoadingManager_1.DefaultLoadingManager;
        this.crossOrigin = 'anonymous';
        this.withCredentials = false;
        this.path = '';
        this.resourcePath = '';
        this.requestHeader = {};
    }
    Loader.prototype.load = function (url, onLoad, onProgress, onError) {
    };
    Loader.prototype.loadAsync = function (url, onProgress) {
        var scope = this;
        return new Promise(function (resolve, reject) {
            // @ts-ignore
            scope.load(url, resolve, onProgress, reject);
        });
    };
    Loader.prototype.parse = function ( /* data */) {
    };
    Loader.prototype.setCrossOrigin = function (crossOrigin) {
        this.crossOrigin = crossOrigin;
        return this;
    };
    Loader.prototype.setWithCredentials = function (value) {
        this.withCredentials = value;
        return this;
    };
    Loader.prototype.setPath = function (path) {
        this.path = path;
        return this;
    };
    Loader.prototype.setResourcePath = function (resourcePath) {
        this.resourcePath = resourcePath;
        return this;
    };
    Loader.prototype.setRequestHeader = function (requestHeader) {
        this.requestHeader = requestHeader;
        return this;
    };
    return Loader;
}());
exports.Loader = Loader;
