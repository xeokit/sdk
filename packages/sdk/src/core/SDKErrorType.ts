/**
 * Enumeration of SDK error types.
 */
export enum SDKErrorType {

    /**
     * Indicates that initialization of a component or system has failed.
     */
    InitializationFailed=0,

    /**
     * Indicates that an operation is invalid in the current context.
     */
    InvalidOperation=1,

    /**
     * Indicates that the input provided to a function or method is invalid.
     */
    InvalidInput = 2,

    /**
     * Indicates that a requested resource could not be found.
     */
    ResourceNotFound = 3,

    /**
     * Indicates that a memory limit has been exceeded.
     */
    MemoryExceeded = 4,

    /**
     * Indicates an unknown error.
     */
    Unknown=5,

    /**
     * Indicates that the requested operation is not supported.
     */
    NotSupported=6,

    /**
     * Indicates that the WebGL context has been lost.
     */
    WebGLContextLost=7
}