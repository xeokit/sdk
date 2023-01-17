export declare function clone(ob: any): any;
export declare function b64(v: number, len: number): string;
export declare function compressGuid(g: string): string;
export declare function findNodeOfType(m: any, t: any): any[];
/**
 */
export declare function timeout(dt: number): Promise<unknown>;
export declare function httpRequest(args: {
    method: string;
    url: string;
}): Promise<unknown>;
export declare const queryString: {};
export declare function loadJSON(url: string, ok: {
    (arg0: any): void;
    (_value: any): any;
}, err: {
    (arg0: string | ProgressEvent<XMLHttpRequestEventTarget>): void;
    (_value: any): any;
}): void;
export declare function loadArraybuffer(url: string, ok: {
    (arg0: ArrayBuffer): void;
    (_value: any): any;
}, err: {
    (arg0: string): void;
    (_value: any): any;
}): void;
/**
 Tests if the given object is an array
 */
export declare function isArray(value: any): any;
/**
 Tests if the given value is a string
 */
export declare function isString(value: any): boolean;
/**
 Tests if the given value is a number
 */
export declare function isNumeric(value: any): boolean;
/**
 Tests if the given value is an ID
 */
export declare function isID(value: any): boolean;
/**
 Tests if the given value is a function
 */
export declare function isFunction(value: any): boolean;
/**
 Tests if the given value is a JavaScript JSON object, eg, ````{ foo: "bar" }````.
 */
export declare function isObject(value: {
    constructor: Function;
}): boolean;
/** Returns a shallow copy
 */
export declare function copy(o: any): any;
/** Add properties of o to o2, overwriting them on o2 if already there
 */
export declare function apply(o: any, o2: any): any;
/**
 Add non-null/defined properties of o to o2
 */
export declare function apply2(o: any, o2: any): any;
/**
 Add properties of o to o2 where undefined or null on o2
 */
export declare function applyIf(o: any, o2: any): any;
/**
 Returns true if the given map is empty.
 */
export declare function isEmptyObject(obj: any): boolean;
/**
 Returns the given ID as a string, in quotes if the ID was a string to begin with.
 This is useful for logging IDs.
 */
export declare function inQuotes(id: any): string;
/**
 Returns the concatenation of two typed arrays.
 */
export declare function concat(a: any, b: any): any;
/**
 * Returns a new UUID.
 */
export declare const createUUID: () => string;
