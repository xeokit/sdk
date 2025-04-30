"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
exports.FileLoader = void 0;
var Cache_1 = require("./Cache");
var Loader_1 = require("./Loader");
var loading = {};
var FileLoader = /** @class */ (function (_super) {
    __extends(FileLoader, _super);
    function FileLoader(manager) {
        return _super.call(this, manager) || this;
    }
    FileLoader.prototype.load = function (url, onLoad, onProgress, onError) {
        var _this = this;
        if (url === undefined) {
            url = '';
        }
        if (this.path !== undefined) {
            url = this.path + url;
        }
        url = this.manager.resolveURL(url);
        var cached = Cache_1.Cache.get(url);
        if (cached !== undefined) {
            this.manager.itemStart(url);
            setTimeout(function () {
                if (onLoad) {
                    onLoad(cached);
                }
                _this.manager.itemEnd(url);
            }, 0);
            return cached;
        }
        if (loading[url] !== undefined) {
            loading[url].push({ onLoad: onLoad, onProgress: onProgress, onError: onError });
            return;
        }
        loading[url] = [];
        loading[url].push({ onLoad: onLoad, onProgress: onProgress, onError: onError });
        var req = new Request(url, {
            headers: new Headers(this.requestHeader),
            credentials: this.withCredentials ? 'include' : 'same-origin'
        });
        var mimeType = this.mimeType;
        var responseType = this.responseType;
        fetch(req).then(function (response) {
            if (response.status === 200 || response.status === 0) {
                // Some browsers return HTTP Status 0 when using non-http protocol
                // e.g. 'file://' or 'data://'. Handle as success.
                if (response.status === 0) {
                    console.warn('FileLoader: HTTP Status 0 received.');
                }
                // @ts-ignore
                if (typeof ReadableStream === 'undefined' || response.body.getReader === undefined) {
                    return response;
                }
                var callbacks_1 = loading[url];
                // @ts-ignore
                var reader_1 = response.body.getReader();
                var contentLength = response.headers.get('Content-Length');
                var total_1 = contentLength ? parseInt(contentLength) : 0;
                var lengthComputable_1 = total_1 !== 0;
                var loaded_1 = 0;
                var stream = new ReadableStream({
                    start: function (controller) {
                        readData();
                        function readData() {
                            reader_1.read().then(function (_a) {
                                var done = _a.done, value = _a.value;
                                if (done) {
                                    controller.close();
                                }
                                else {
                                    // @ts-ignore
                                    loaded_1 += value.byteLength;
                                    var event_1 = new ProgressEvent('progress', { lengthComputable: lengthComputable_1, loaded: loaded_1, total: total_1 });
                                    for (var i = 0, il = callbacks_1.length; i < il; i++) {
                                        var callback = callbacks_1[i];
                                        if (callback.onProgress) {
                                            callback.onProgress(event_1);
                                        }
                                    }
                                    controller.enqueue(value);
                                    readData();
                                }
                            });
                        }
                    }
                });
                return new Response(stream);
            }
            else {
                throw new Error("fetch for \"".concat(response.url, "\" responded with ").concat(response.status, ": ").concat(response.statusText));
            }
        }).then(function (response) {
            switch (responseType) {
                case 'arraybuffer':
                    return response.arrayBuffer();
                case 'blob':
                    return response.blob();
                case 'document':
                    return response.text()
                        .then(function (text) {
                        var parser = new DOMParser();
                        // @ts-ignore
                        return parser.parseFromString(text, mimeType);
                    });
                case 'json':
                    return response.json();
                default:
                    if (mimeType === undefined) {
                        return response.text();
                    }
                    else {
                        // sniff encoding
                        var re = /charset="?([^;"\s]*)"?/i;
                        var exec = re.exec(mimeType);
                        var label = exec && exec[1] ? exec[1].toLowerCase() : undefined;
                        var decoder_1 = new TextDecoder(label);
                        return response.arrayBuffer().then(function (ab) { return decoder_1.decode(ab); });
                    }
            }
        }).then(function (data) {
            // Add to cache only on HTTP success, so that we do not cache
            // error response bodies as proper responses to requests.
            Cache_1.Cache.add(url, data);
            var callbacks = loading[url];
            delete loading[url];
            for (var i = 0, il = callbacks.length; i < il; i++) {
                var callback = callbacks[i];
                if (callback.onLoad) {
                    callback.onLoad(data);
                }
            }
        })["catch"](function (err) {
            // Abort errors and other errors are handled the same
            var callbacks = loading[url];
            if (callbacks === undefined) {
                // When onLoad was called and url was deleted in `loading`
                _this.manager.itemError(url);
                throw err;
            }
            delete loading[url];
            for (var i = 0, il = callbacks.length; i < il; i++) {
                var callback = callbacks[i];
                if (callback.onError) {
                    callback.onError(err);
                }
            }
            _this.manager.itemError(url);
        })["finally"](function () {
            _this.manager.itemEnd(url);
        });
        this.manager.itemStart(url);
    };
    FileLoader.prototype.setResponseType = function (value) {
        this.responseType = value;
        return this;
    };
    FileLoader.prototype.setMimeType = function (value) {
        this.mimeType = value;
        return this;
    };
    return FileLoader;
}(Loader_1.Loader));
exports.FileLoader = FileLoader;
