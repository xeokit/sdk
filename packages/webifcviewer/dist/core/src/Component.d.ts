import { EventEmitter } from "./EventEmitter";
/**
 * Common base class for xeokit SDK components.
 *
 * ## Summary
 *
 * * Unique ID
 * * Logging methods
 * * Manages lifecycle of child Components
 */
export declare class Component {
    #private;
    /**
     * Unique ID of this Component.
     */
    id: string;
    /**
     * True once this Component has been destroyed.
     *
     * Don't use this Component if this is ````true````.
     */
    destroyed: boolean;
    protected dirty: boolean;
    /**
     * Emits an event when the {@link @xeokit/core!Component} has been destroyed.
     *
     * @event
     */
    onDestroyed: EventEmitter<Component, null>;
    /**
     * Creates a new component.
     */
    constructor(owner: null | Component, cfg?: {
        id?: string;
        [key: string]: any;
    });
    /**
     * Logs a message for this component.
     *
     * The message will have this format: *````[LOG] [<component type> <component id>: <message>````*
     *
     * @param message - The message to log
     * @protected
     */
    log(message: string): void;
    /**
     * Logs a warning for this component to the JavaScript console.
     *
     * The console message will have this format: *````[WARN] [<component type> =<component id>: <message>````*
     *
     * @param message - The warning message to log
     * @protected
     */
    warn(message: string): void;
    /**
     * Logs an error for this component to the JavaScript console.
     *
     * The console message will have this format: *````[ERROR] [<component type> =<component id>: <message>````*

     @param message The error message to log
     @protected
     */
    error(message: string): void;
    /**
     * Flags this component as having a defered state updates it needs to perform.
     */
    protected setDirty(): void;
    /**
     * Gives this component an opportunity to action any defered state updates.
     */
    protected cleanIfDirty(): void;
    /**
     * Forces this component to action any deferred state updates.
     */
    protected clean(): void;
    /**
     * Destroys this component.
     *
     * Also destroys any components owned by this one.
     *
     * Sets {@link Component.destroyed} ````true````.
     *
     * Cancels any deferred state updates.
     */
    destroy(): void;
}
