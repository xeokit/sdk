"use strict";
/**
 * ## xeokit SDK Core Utilities Library
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * @module utils
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
exports.__esModule = true;
exports.createUUID = exports.concat = exports.inQuotes = exports.isEmptyObject = exports.applyIf = exports.apply2 = exports.apply = exports.copy = exports.isObject = exports.isFunction = exports.isID = exports.isNumeric = exports.isString = exports.isArray = exports.saveJSON = exports.saveArrayBuffer = exports.loadArraybuffer = exports.loadJSON = exports.httpRequest = exports.timeout = exports.findNodeOfType = exports.compressGuid = exports.b64 = exports.clone = exports.isJSONObject = void 0;
__exportStar(require("./Map"), exports);
__exportStar(require("./Queue"), exports);
__exportStar(require("./Loader"), exports);
__exportStar(require("./LoadingManager"), exports);
__exportStar(require("./WorkerPool"), exports);
__exportStar(require("./Cache"), exports);
__exportStar(require("./FileLoader"), exports);
/**
 *
 * @param arg
 */
function isJSONObject(arg) {
    return typeof arg === 'object' && arg !== null && !Array.isArray(arg);
}
exports.isJSONObject = isJSONObject;
/**
 *
 * @param ob
 */
function clone(ob) {
    return JSON.parse(JSON.stringify(ob));
}
exports.clone = clone;
var guidChars = [["0", 10], ["A", 26], ["a", 26], ["_", 1], ["$", 1]].map(function (a) {
    var li = [];
    // @ts-ignore
    var st = a[0].charCodeAt(0);
    var en = st + a[1];
    for (var i = st; i < en; ++i) {
        li.push(i);
    }
    return String.fromCharCode.apply(null, li);
}).join("");
/**
 *
 * @param v
 * @param len
 */
function b64(v, len) {
    var r = (!len || len === 4) ? [0, 6, 12, 18] : [0, 6];
    return r.map(function (i) {
        return guidChars.substr(parseInt(String(v / (1 << i))) % 64, 1);
    }).reverse().join("");
}
exports.b64 = b64;
/**
 *
 * @param g
 */
function compressGuid(g) {
    var bs = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30].map(function (i) {
        return parseInt(g.substr(i, 2), 16);
    });
    return b64(bs[0], 2) + [1, 4, 7, 10, 13].map(function (i) {
        return b64((bs[i] << 16) + (bs[i + 1] << 8) + bs[i + 2], 4);
    }).join("");
}
exports.compressGuid = compressGuid;
/**
 *
 * @param m
 * @param t
 */
function findNodeOfType(m, t) {
    var li = [];
    var _ = function (n) {
        if (n.type === t)
            li.push(n);
        (n.children || []).forEach(function (c) {
            _(c);
        });
    };
    _(m);
    return li;
}
exports.findNodeOfType = findNodeOfType;
/**
 */
function timeout(dt) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, dt);
    });
}
exports.timeout = timeout;
function httpRequest(args) {
    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open(args.method || "GET", args.url, true);
        xhr.onload = function (e) {
            console.log(args.url, xhr.readyState, xhr.status);
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    resolve(xhr.responseXML);
                }
                else {
                    reject(xhr.statusText);
                }
            }
        };
        xhr.send(null);
    });
}
exports.httpRequest = httpRequest;
//
// export const queryString = function () {
//     // This function is anonymous, is executed immediately and
//     // the return value is assigned to QueryString!
//     const query_string = {};
//     const query = window.location.search.substring(1);
//     const vars = query.split("&");
//     for (let i = 0; i < vars.length; i++) {
//         const pair = vars[i].split("=");
//         // If first entry with this name
//         // @ts-ignore
//         if (typeof query_string[pair[0]] === "undefined") {
//             // @ts-ignore
//             query_string[pair[0]] = decodeURIComponent(pair[1]);
//             // If second entry with this name
//         } else { // @ts-ignore
//             if (typeof query_string[pair[0]] === "string") {
//                 // @ts-ignore
//                 query_string[pair[0]] = [query_string[pair[0]], decodeURIComponent(pair[1])];
//                 // If third or later entry with this name
//             } else {
//                 // @ts-ignore
//                 query_string[pair[0]].push(decodeURIComponent(pair[1]));
//             }
//         }
//     }
//     return query_string;
// }();
function loadJSON(url, ok, err) {
    // Avoid checking ok and err on each use.
    // @ts-ignore
    var defaultCallback = function (_value) { return undefined; };
    ok = ok || defaultCallback;
    err = err || defaultCallback;
    var request = new XMLHttpRequest();
    request.overrideMimeType("application/json");
    request.open('GET', url, true);
    request.addEventListener('load', function (event) {
        // @ts-ignore
        var response = event.target.response;
        if (this.status === 200) {
            var json = void 0;
            try {
                json = JSON.parse(response);
            }
            catch (e) {
                err("utils.loadJSON(): Failed to parse JSON response - ".concat(e));
            }
            ok(json);
        }
        else if (this.status === 0) {
            // Some browsers return HTTP Status 0 when using non-http protocol
            // e.g. 'file://' or 'data://'. Handle as success.
            console.warn('loadFile: HTTP Status 0 received.');
            try {
                ok(JSON.parse(response));
            }
            catch (e) {
                err("utils.loadJSON(): Failed to parse JSON response - ".concat(e));
            }
        }
        else {
            err(event);
        }
    }, false);
    request.addEventListener('error', function (event) {
        err(event);
    }, false);
    request.send(null);
}
exports.loadJSON = loadJSON;
function loadArraybuffer(url, ok, err) {
    // Check for data: URI
    // @ts-ignore
    var defaultCallback = function (_value) { return undefined; };
    ok = ok || defaultCallback;
    err = err || defaultCallback;
    var dataUriRegex = /^data:(.*?)(;base64)?,(.*)$/;
    var dataUriRegexResult = url.match(dataUriRegex);
    if (dataUriRegexResult) { // Safari can't handle data URIs through XMLHttpRequest
        var isBase64 = !!dataUriRegexResult[2];
        var data = dataUriRegexResult[3];
        data = window.decodeURIComponent(data);
        if (isBase64) {
            data = window.atob(data);
        }
        try {
            var buffer_1 = new ArrayBuffer(data.length);
            var view = new Uint8Array(buffer_1);
            for (var i = 0; i < data.length; i++) {
                view[i] = data.charCodeAt(i);
            }
            window.setTimeout(function () {
                ok(buffer_1);
            }, 0);
        }
        catch (error) {
            window.setTimeout(function () {
                err(error);
            }, 0);
        }
    }
    else {
        var request_1 = new XMLHttpRequest();
        request_1.open('GET', url, true);
        request_1.responseType = 'arraybuffer';
        request_1.onreadystatechange = function () {
            if (request_1.readyState === 4) {
                if (request_1.status === 200) {
                    ok(request_1.response);
                }
                else {
                    err('loadArrayBuffer error : ' + request_1.response);
                }
            }
        };
        request_1.send(null);
    }
}
exports.loadArraybuffer = loadArraybuffer;
/** Downloads an ArrayBuffer to a file.
 *
 * @param arrayBuffer
 * @param filename
 */
function saveArrayBuffer(arrayBuffer, filename) {
    var blob = new Blob([arrayBuffer], { type: "application/octet-stream" });
    var link = document.createElement('a');
    link.download = filename;
    link.href = window.URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
exports.saveArrayBuffer = saveArrayBuffer;
/** Downloads JSON to a file.
 *
 * @param arrayBuffer
 * @param filename
 */
function saveJSON(data, filename) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var link = document.createElement('a');
    link.download = filename;
    link.href = window.URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
exports.saveJSON = saveJSON;
/**
 Tests if the given object is an array
 */
function isArray(value) {
    return value && !(value.propertyIsEnumerable('length')) && typeof value === 'object' && typeof value.length === 'number';
}
exports.isArray = isArray;
/**
 Tests if the given value is a string
 */
function isString(value) {
    return (typeof value === 'string' || value instanceof String);
}
exports.isString = isString;
/**
 Tests if the given value is a number
 */
function isNumeric(value) {
    return !isNaN(parseFloat(value)) && isFinite(value);
}
exports.isNumeric = isNumeric;
/**
 Tests if the given value is an ID
 */
function isID(value) {
    return isString(value) || isNumeric(value);
}
exports.isID = isID;
/**
 Tests if the given value is a function
 */
function isFunction(value) {
    return (typeof value === "function");
}
exports.isFunction = isFunction;
/**
 Tests if the given value is a JavaScript JSON object, eg, ````{ foo: "bar" }````.
 */
function isObject(value) {
    var objectConstructor = {}.constructor;
    return (!!value && value.constructor === objectConstructor);
}
exports.isObject = isObject;
/** Returns a shallow copy
 */
function copy(o) {
    return apply(o, {});
}
exports.copy = copy;
/** Add properties of o to o2, overwriting them on o2 if already there
 */
function apply(o, o2) {
    for (var name_1 in o) {
        if (o.hasOwnProperty(name_1)) {
            o2[name_1] = o[name_1];
        }
    }
    return o2;
}
exports.apply = apply;
/**
 Add non-null/defined properties of o to o2
 */
function apply2(o, o2) {
    for (var name_2 in o) {
        if (o.hasOwnProperty(name_2)) {
            if (o[name_2] !== undefined && o[name_2] !== null) {
                o2[name_2] = o[name_2];
            }
        }
    }
    return o2;
}
exports.apply2 = apply2;
/**
 Add properties of o to o2 where undefined or null on o2
 */
function applyIf(o, o2) {
    for (var name_3 in o) {
        if (o.hasOwnProperty(name_3)) {
            if (o2[name_3] === undefined || o2[name_3] === null) {
                o2[name_3] = o[name_3];
            }
        }
    }
    return o2;
}
exports.applyIf = applyIf;
/**
 Returns true if the given map is empty.
 */
function isEmptyObject(obj) {
    for (var name_4 in obj) {
        if (obj.hasOwnProperty(name_4)) {
            return false;
        }
    }
    return true;
}
exports.isEmptyObject = isEmptyObject;
/**
 Returns the given ID as a string, in quotes if the ID was a string to begin with.
 This is useful for logging IDs.
 */
function inQuotes(id) {
    return isNumeric(id) ? ("".concat(id)) : ("'".concat(id, "'"));
}
exports.inQuotes = inQuotes;
/**
 Returns the concatenation of two typed arrays.
 */
function concat(a, b) {
    var c = new a.constructor(a.length + b.length);
    c.set(a);
    c.set(b, a.length);
    return c;
}
exports.concat = concat;
/**
 * Returns a new UUID.
 */
exports.createUUID = ((function () {
    var lut = [];
    for (var i = 0; i < 256; i++) {
        lut[i] = (i < 16 ? '0' : '') + (i).toString(16);
    }
    return function () {
        var d0 = Math.random() * 0xffffffff | 0;
        var d1 = Math.random() * 0xffffffff | 0;
        var d2 = Math.random() * 0xffffffff | 0;
        var d3 = Math.random() * 0xffffffff | 0;
        return "".concat(lut[d0 & 0xff] + lut[d0 >> 8 & 0xff] + lut[d0 >> 16 & 0xff] + lut[d0 >> 24 & 0xff], "-").concat(lut[d1 & 0xff]).concat(lut[d1 >> 8 & 0xff], "-").concat(lut[d1 >> 16 & 0x0f | 0x40]).concat(lut[d1 >> 24 & 0xff], "-").concat(lut[d2 & 0x3f | 0x80]).concat(lut[d2 >> 8 & 0xff], "-").concat(lut[d2 >> 16 & 0xff]).concat(lut[d2 >> 24 & 0xff]).concat(lut[d3 & 0xff]).concat(lut[d3 >> 8 & 0xff]).concat(lut[d3 >> 16 & 0xff]).concat(lut[d3 >> 24 & 0xff]);
    };
}))();
