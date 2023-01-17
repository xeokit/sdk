import { WebViewer } from "./WebViewer";
import { EventEmitter } from "./EventEmitter";
/**
 The base class for xeokit {@link WebViewer} components.

 ## Summary

 - Has logging methods
 - Optionally manages lifecycle of owned Components
 */
export declare class Component {
    #private;
    /**
     The WebViewer to which this Component belongs.
     */
    readonly viewer: WebViewer;
    /**
     ID of this Component, unique within the {@link WebViewer}.
     */
    id: string;
    /**
     True once this Component has been destroyed.

     Don't use this Component if this is ````true````.
     */
    protected destroyed: boolean;
    protected dirty: boolean;
    /**
     * Emits an event when the {@link Component} has been destroyed.
     *
     * @event
     */
    onDestroyed: EventEmitter<Component, null>;
    /**
     Creates a new component.

     @param owner - An optional owner component; when the owner is destroyed, this component will be automatically destroyed also.
     @param cfg - Component configuration
     @param cfg.id - Optional ID for the component
     */
    constructor(owner: null | Component, cfg?: {
        id?: string;
        [key: string]: any;
    });
    /**
     Logs a console debugging message for this component.

     The console message will have this format: *````[LOG] [<component type> <component id>: <message>````*

     Also fires the message as a "log" event on the parent {@link WebViewer}.

     @param message - The message to log
     @protected
     */
    log(message: string): void;
    /**
     Logs a warning for this component to the JavaScript console.

     The console message will have this format: *````[WARN] [<component type> =<component id>: <message>````*

     Also fires the message as a "warn" event on the parent {@link WebViewer}.

     @param message - The warning message to log
     @protected
     */
    warn(message: string): void;
    /**
     Logs an error for this component to the JavaScript console.

     The console message will have this format: *````[ERROR] [<component type> =<component id>: <message>````*

     Also fires the message as an "error" event on the {@link WebViewer}.

     @param message The error message to log
     @protected
     */
    error(message: string): void;
    /**
     @private
     */
    cleanIfDirty(): void;
    /**
     @private
     */
    clean(): void;
    /**
     Destroys this component.

     Also destroys any components owned by this one.

     Sets {@link Component.destroyed} ````true````.

     @private

     */
    destroy(): void;
    protected setDirty(): void;
}
