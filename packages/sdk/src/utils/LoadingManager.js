"use strict";
exports.__esModule = true;
exports.LoadingManager = exports.DefaultLoadingManager = void 0;
var LoadingManager = /** @class */ (function () {
    function LoadingManager(onLoad, onProgress, onError) {
        this.isLoading = false;
        this.itemsLoaded = 0;
        this.itemsTotal = 0;
        this.urlModifier = undefined;
        this.handlers = [];
        this.onStart = undefined;
        this.onLoad = onLoad;
        this.onProgress = onProgress;
        this.onError = onError;
    }
    LoadingManager.prototype.itemStart = function (url) {
        this.itemsTotal++;
        if (!this.isLoading) {
            if (this.onStart !== undefined) {
                this.onStart(url, this.itemsLoaded, this.itemsTotal);
            }
        }
        this.isLoading = true;
    };
    LoadingManager.prototype.itemEnd = function (url) {
        this.itemsLoaded++;
        if (this.onProgress !== undefined) {
            this.onProgress(url, this.itemsLoaded, this.itemsTotal);
        }
        if (this.itemsLoaded === this.itemsTotal) {
            this.isLoading = false;
            if (this.onLoad !== undefined) {
                this.onLoad();
            }
        }
    };
    LoadingManager.prototype.itemError = function (url) {
        if (this.onError !== undefined) {
            this.onError(url);
        }
    };
    LoadingManager.prototype.resolveURL = function (url) {
        if (this.urlModifier) {
            // @ts-ignore
            return this.urlModifier(url);
        }
        return url;
    };
    LoadingManager.prototype.setURLModifier = function (transform) {
        this.urlModifier = transform;
        return this;
    };
    LoadingManager.prototype.addHandler = function (regex, loader) {
        this.handlers.push(regex, loader);
        return this;
    };
    LoadingManager.prototype.removeHandler = function (regex) {
        var index = this.handlers.indexOf(regex);
        if (index !== -1) {
            this.handlers.splice(index, 2);
        }
        return this;
    };
    LoadingManager.prototype.getHandler = function (file) {
        for (var i = 0, l = this.handlers.length; i < l; i += 2) {
            var regex = this.handlers[i];
            var loader = this.handlers[i + 1];
            if (regex.global)
                regex.lastIndex = 0; // see #17920
            if (regex.test(file)) {
                return loader;
            }
        }
        return null;
    };
    return LoadingManager;
}());
exports.LoadingManager = LoadingManager;
// @ts-ignore
var DefaultLoadingManager = new LoadingManager();
exports.DefaultLoadingManager = DefaultLoadingManager;
