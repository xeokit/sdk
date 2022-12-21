import {scheduler} from "./scheduler";
import * as utils from './utils/index';
import {Viewer} from "./Viewer";
import {EventEmitter, SceneModel} from "@xeokit-viewer/viewer";
import {EventDispatcher} from "strongly-typed-events";

/**
 The base class for xeokit {@link Viewer} components.

 ## Summary

 - Has logging methods
 - Optionally manages lifecycle of owned Components
 */
export class Component {

    /**
     The Viewer to which this Component belongs.
     */
    public readonly viewer: Viewer;

    /**
     ID of this Component, unique within the {@link Viewer}.
     */
    public id: string;

    /**
     True once this Component has been destroyed.

     Don't use this Component if this is ````true````.
     */
    protected destroyed: boolean;

    protected dirty: boolean;

    readonly #owner?: Component;

    #ownedComponents: null | { [key: string]: Component };

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
    constructor(owner: null | Component, cfg: { id?: string, [key: string]: any } = {}) {
        if (this instanceof Viewer) {
            this.viewer = this;
            this.#owner = undefined;
        } else {
            if (owner instanceof Viewer) {
                this.viewer = owner;
            } else if (owner instanceof Component) {
                this.viewer = owner.viewer;
            } else {
                throw "Invalid Component constructor argument: 'owner' must be a Component"
            }
            this.#owner = owner;
        }
        this.id = cfg.id || utils.createUUID();
        this.destroyed = false;
        this.#ownedComponents = null; // // Components created with #create - lazy-instantiated
        this.dirty = false; // True when #update will be called on next tick
        if (owner) {
            owner.#own(this);
        }
        this.onDestroyed = new EventEmitter(new EventDispatcher<Component, null>())
    }

    /**
     Logs a console debugging message for this component.

     The console message will have this format: *````[LOG] [<component type> <component id>: <message>````*

     Also fires the message as a "log" event on the parent {@link Viewer}.

     @param message - The message to log
     @protected
     */
    log(message: string): void {
        message = `[LOG] ${this.#prefixMessageWithID(message)}`;
        window.console.log(message);
        //  this.viewer.events.fire("log", message);
    }

    /**
     Logs a warning for this component to the JavaScript console.

     The console message will have this format: *````[WARN] [<component type> =<component id>: <message>````*

     Also fires the message as a "warn" event on the parent {@link Viewer}.

     @param message - The warning message to log
     @protected
     */
    warn(message: string): void {
        message = `[WARN] ${this.#prefixMessageWithID(message)}`;
        window.console.warn(message);
        //  this.viewer.events.fire("warn", message);
    }

    /**
     Logs an error for this component to the JavaScript console.

     The console message will have this format: *````[ERROR] [<component type> =<component id>: <message>````*

     Also fires the message as an "error" event on the {@link Viewer}.

     @param message The error message to log
     @protected
     */
    error(message: string): void {
        message = `[ERROR] ${this.#prefixMessageWithID(message)}`;
        window.console.error(message);
        //   this.viewer.events.fire("error", message);
    }

    /**
     @private
     */
    cleanIfDirty(): void {
        if (this.dirty) {
            this.dirty = false;
            this.clean();
        }
    }

    /**
     @private
     */
    clean(): void {
    }

    /**
     Destroys this component.

     Also destroys any components owned by this one.

     Sets {@link Component.destroyed} ````true````.

     @private

     */
    destroy(): void {
        if (this.destroyed) {
            return;
        }
        this.onDestroyed.dispatch(this, null);
        this.onDestroyed.clear();
        this.destroyed = true;
        if (this.#ownedComponents) {
            for (let id in this.#ownedComponents) {
                if (this.#ownedComponents.hasOwnProperty(id)) {
                    const component = this.#ownedComponents[id];
                    component.destroy();
                    delete this.#ownedComponents[id];
                }
            }
        }
        this.#ownedComponents = null;
        this.dirty = false;
    }

    protected setDirty(): void {
        if (this.dirty) {
            return;
        }
        scheduler.scheduleTask(this.cleanIfDirty, this);
        this.dirty = true;
    }

    #prefixMessageWithID(message: string): string {
        return ` [${this.constructor.name} "${utils.inQuotes(this.id)}"]: ${message}`;
    }

    #own(component: Component) {
        if (!this.#ownedComponents) {
            this.#ownedComponents = {};
        }
        if (!this.#ownedComponents[component.id]) {
            this.#ownedComponents[component.id] = component;
        }
        component.onDestroyed.one(() => {
            // @ts-ignore
            delete this.#ownedComponents[component.id];
        });
    }
}


