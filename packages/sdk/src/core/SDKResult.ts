import {SDKErrorType} from "./SDKErrorType";

/**
 * A type representing the result of an operation that can either succeed with a value of type T
 * or fail with an error of type E.
 */
export type SDKResult<T, E> =
    | { ok: true; value: T }
    | { ok: false; error:string; type: SDKErrorType;  };

