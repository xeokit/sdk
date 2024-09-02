/**
 * ## xeokit SDK Core Utilities Library
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/utils
 * ````
 *
 * @module @xeokit/utils
 */

export * from "./Map";
export * from "./Queue";
export * from "./Loader";
export * from "./LoadingManager";
export * from "./WorkerPool";
export * from "./Cache";
export * from "./FileLoader";

/**
 *
 * @param arg
 */
export function isJSONObject(arg) {
    return typeof arg === 'object' && arg !== null && !Array.isArray(arg);
}
/**
 *
 * @param ob
 */
export function clone(ob: any) {
    return JSON.parse(JSON.stringify(ob));
}

const guidChars = [["0", 10], ["A", 26], ["a", 26], ["_", 1], ["$", 1]].map(function (a) {
    const li :any[]= [];
    // @ts-ignore
    const st = a[0].charCodeAt(0);
    const en = st + a[1];
    for (let i = st; i < en; ++i) {
        li.push(i);
    }
    return String.fromCharCode.apply(null, li);
}).join("");

/**
 *
 * @param v
 * @param len
 */
export function b64(v: number, len: number) {
    const r = (!len || len === 4) ? [0, 6, 12, 18] : [0, 6];
    return r.map(function (i) {
            return guidChars.substr(parseInt(String(v / (1 << i))) % 64, 1)
        }
    ).reverse().join("");
}

/**
 *
 * @param g
 */
export function compressGuid(g: string) {
    const bs = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30].map(function (i) {
        return parseInt(g.substr(i, 2), 16);
    });
    return b64(bs[0], 2) + [1, 4, 7, 10, 13].map(function (i) {
        return b64((bs[i] << 16) + (bs[i + 1] << 8) + bs[i + 2], 4);
    }).join("");
}

/**
 *
 * @param m
 * @param t
 */
export function findNodeOfType(m: any, t: any) {
    const li: any[] = [];
    const _ = function (n: { type: any; children: any; }) {
        if (n.type === t) li.push(n);
        (n.children || []).forEach(function (c: { type: any; children: any; }) {
            _(c);
        });
    };
    _(m);
    return li;
}

/**
 */
export function timeout(dt: number) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, dt);
    });
}

export function httpRequest(args: { method: string; url: string; }) {
    return new Promise(function (resolve, reject) {
        const xhr = new XMLHttpRequest();
        xhr.open(args.method || "GET", args.url, true);
        xhr.onload = function (e) {
            console.log(args.url, xhr.readyState, xhr.status);
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    resolve(xhr.responseXML);
                } else {
                    reject(xhr.statusText);
                }
            }
        };
        xhr.send(null);
    });
}
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

export function loadJSON(url: string,
                         ok: {
                             (arg0: any): void;
                             (_value: any): any;
                         },
                         err: {
                             (arg0: string | ProgressEvent<XMLHttpRequestEventTarget>): void;
                             (_value: any): any;
                         }) {
    // Avoid checking ok and err on each use.
    // @ts-ignore
    const defaultCallback = (_value) => undefined;
    ok = ok || defaultCallback;
    err = err || defaultCallback;

    const request = new XMLHttpRequest();
    request.overrideMimeType("application/json");
    request.open('GET', url, true);
    request.addEventListener('load', function (event) {
        // @ts-ignore
        const response = event.target.response;
        if (this.status === 200) {
            let json;
            try {
                json = JSON.parse(response);
            } catch (e) {
                err(`utils.loadJSON(): Failed to parse JSON response - ${e}`);
            }
            ok(json);
        } else if (this.status === 0) {
            // Some browsers return HTTP Status 0 when using non-http protocol
            // e.g. 'file://' or 'data://'. Handle as success.
            console.warn('loadFile: HTTP Status 0 received.');
            try {
                ok(JSON.parse(response));
            } catch (e) {
                err(`utils.loadJSON(): Failed to parse JSON response - ${e}`);
            }
        } else {
            err(event);
        }
    }, false);

    request.addEventListener('error', function (event) {
        err(event);
    }, false);
    request.send(null);
}

export function loadArraybuffer(url: string, ok: { (arg0: ArrayBuffer): void; (_value: any): any; }, err: { (arg0: string): void; (_value: any): any; }) {
    // Check for data: URI
    // @ts-ignore
    const defaultCallback = (_value) => undefined;
    ok = ok || defaultCallback;
    err = err || defaultCallback;
    const dataUriRegex = /^data:(.*?)(;base64)?,(.*)$/;
    const dataUriRegexResult = url.match(dataUriRegex);
    if (dataUriRegexResult) { // Safari can't handle data URIs through XMLHttpRequest
        const isBase64 = !!dataUriRegexResult[2];
        let data = dataUriRegexResult[3];
        data = window.decodeURIComponent(data);
        if (isBase64) {
            data = window.atob(data);
        }
        try {
            const buffer = new ArrayBuffer(data.length);
            const view = new Uint8Array(buffer);
            for (let i = 0; i < data.length; i++) {
                view[i] = data.charCodeAt(i);
            }
            window.setTimeout(function () {
                ok(buffer);
            }, 0);
        } catch (error) {
            window.setTimeout(function () {
                err(error);
            }, 0);
        }
    } else {
        const request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';
        request.onreadystatechange = function () {
            if (request.readyState === 4) {
                if (request.status === 200) {
                    ok(request.response);
                } else {
                    err('loadArrayBuffer error : ' + request.response);
                }
            }
        };
        request.send(null);
    }
}

/** Downloads an ArrayBuffer to a file.
 *
 * @param arrayBuffer
 * @param filename
 */
export function saveArrayBuffer(arrayBuffer: ArrayBuffer, filename: string) {
    const blob = new Blob([arrayBuffer], {type: "application/octet-stream"});
    const link = document.createElement('a');
    link.download = filename;
    link.href = window.URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/** Downloads JSON to a file.
 *
 * @param arrayBuffer
 * @param filename
 */
export function saveJSON(data:any, filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = filename;
    link.href = window.URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 Tests if the given object is an array
 */
export function isArray(value: any) {
    return value && !(value.propertyIsEnumerable('length')) && typeof value === 'object' && typeof value.length === 'number';
}

/**
 Tests if the given value is a string
 */
export function isString(value: any) {
    return (typeof value === 'string' || value instanceof String);
}

/**
 Tests if the given value is a number
 */
export function isNumeric(value: any) {
    return !isNaN(parseFloat(value)) && isFinite(value);
}

/**
 Tests if the given value is an ID
 */
export function isID(value: any) {
    return isString(value) || isNumeric(value);
}

/**
 Tests if the given value is a function
 */
export function isFunction(value: any) {
    return (typeof value === "function");
}

/**
 Tests if the given value is a JavaScript JSON object, eg, ````{ foo: "bar" }````.
 */
export function isObject(value: { constructor: Function; }) {
    const objectConstructor = {}.constructor;
    return (!!value && value.constructor === objectConstructor);
}

/** Returns a shallow copy
 */
export function copy(o: any) {
    return apply(o, {});
}

/** Add properties of o to o2, overwriting them on o2 if already there
 */
export function apply(o: any, o2: any) {
    for (const name in o) {
        if (o.hasOwnProperty(name)) {
            o2[name] = o[name];
        }
    }
    return o2;
}

/**
 Add non-null/defined properties of o to o2
 */
export function apply2(o: any, o2: any) {
    for (const name in o) {
        if (o.hasOwnProperty(name)) {
            if (o[name] !== undefined && o[name] !== null) {
                o2[name] = o[name];
            }
        }
    }
    return o2;
}

/**
 Add properties of o to o2 where undefined or null on o2
 */
export function applyIf(o: any, o2: any) {
    for (const name in o) {
        if (o.hasOwnProperty(name)) {
            if (o2[name] === undefined || o2[name] === null) {
                o2[name] = o[name];
            }
        }
    }
    return o2;
}

/**
 Returns true if the given map is empty.
 */
export function isEmptyObject(obj: any) {
    for (const name in obj) {
        if (obj.hasOwnProperty(name)) {
            return false;
        }
    }
    return true;
}

/**
 Returns the given ID as a string, in quotes if the ID was a string to begin with.
 This is useful for logging IDs.
 */
export function inQuotes(id: any) {
    return isNumeric(id) ? (`${id}`) : (`'${id}'`);
}

/**
 Returns the concatenation of two typed arrays.
 */
export function concat(a: any, b: any) {
    const c = new a.constructor(a.length + b.length);
    c.set(a);
    c.set(b, a.length);
    return c;
}

/**
 * Returns a new UUID.
 */
export const createUUID = ((() => {
    const lut: any[] = [];
    for (let i = 0; i < 256; i++) {
        lut[i] = (i < 16 ? '0' : '') + (i).toString(16);
    }
    return () => {
        const d0 = Math.random() * 0xffffffff | 0;
        const d1 = Math.random() * 0xffffffff | 0;
        const d2 = Math.random() * 0xffffffff | 0;
        const d3 = Math.random() * 0xffffffff | 0;
        return `${lut[d0 & 0xff] + lut[d0 >> 8 & 0xff] + lut[d0 >> 16 & 0xff] + lut[d0 >> 24 & 0xff]}-${lut[d1 & 0xff]}${lut[d1 >> 8 & 0xff]}-${lut[d1 >> 16 & 0x0f | 0x40]}${lut[d1 >> 24 & 0xff]}-${lut[d2 & 0x3f | 0x80]}${lut[d2 >> 8 & 0xff]}-${lut[d2 >> 16 & 0xff]}${lut[d2 >> 24 & 0xff]}${lut[d3 & 0xff]}${lut[d3 >> 8 & 0xff]}${lut[d3 >> 16 & 0xff]}${lut[d3 >> 24 & 0xff]}`;
    };
}))();
