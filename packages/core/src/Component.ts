import * as utils from './utils';
import {EventEmitter} from "./EventEmitter";
import {EventDispatcher} from "strongly-typed-events";

/**
 * Common base class for xeokit SDK components.
 *
 * ## Summary
 *
 * * Unique ID
 * * Logging methods
 * * Manages lifecycle of child Components
 */
export class Component {

    /**
     * Unique ID of this Component.
     */
    public id: string;

    /**
     * True once this Component has been destroyed.
     *
     * Don't use this Component if this is ````true````.
     */
    public destroyed: boolean;

    protected dirty: boolean;

    readonly #owner?: Component | null;

    #ownedComponents: null | { [key: string]: Component };

    /**
     * Emits an event when the {@link @xeokit/core/components!Component} has been destroyed.
     *
     * @event
     */
    onDestroyed: EventEmitter<Component, null>;

    /**
     * Creates a new component.
     */
    constructor(owner: null | Component, cfg: { id?: string, [key: string]: any } = {}) {
        this.#owner = owner;
        this.id = cfg.id || utils.createUUID();
        this.destroyed = false;
        this.#ownedComponents = null;
        this.dirty = false;
        this.onDestroyed = new EventEmitter(new EventDispatcher<Component, null>());
        if (owner) {
            owner.#own(this);
        }
    }

    /**
     * Logs a message for this component.
     *
     * The message will have this format: *````[LOG] [<component type> <component id>: <message>````*
     *
     * @param message - The message to log
     * @protected
     */
    log(message: string): void {
        message = `[LOG] ${this.#prefixMessageWithID(message)}`;
        console.log(message);
    }

    /**
     * Logs a warning for this component to the JavaScript console.
     *
     * The console message will have this format: *````[WARN] [<component type> =<component id>: <message>````*
     *
     * @param message - The warning message to log
     * @protected
     */
    warn(message: string): void {
        message = `[WARN] ${this.#prefixMessageWithID(message)}`;
        console.warn(message);
    }

    /**
     * Logs an error for this component to the JavaScript console.
     *
     * The console message will have this format: *````[ERROR] [<component type> =<component id>: <message>````*

     @param message The error message to log
     @protected
     */
    error(message: string): void {
        message = `[ERROR] ${this.#prefixMessageWithID(message)}`;
        console.error(message);
    }

    /**
     * Flags this component as having a defered state updates it needs to perform.
     */
    protected setDirty(): void {
        if (this.dirty) {
            return;
        }
        this.dirty = true;
    }

    /**
     * Gives this component an opportunity to action any defered state updates.
     */
    protected cleanIfDirty(): void {
        if (this.dirty) {
            this.dirty = false;
            this.clean();
        }
    }

    /**
     * Forces this component to action any deferred state updates.
     */
    protected clean(): void {
    }

    /**
     * Destroys this component.
     *
     * Also destroys any components owned by this one.
     *
     * Sets {@link Component.destroyed} ````true````.
     *
     * Cancels any deferred state updates.
     */
    destroy(): void {
        if (this.destroyed) {
            return;
        }
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
        this.onDestroyed.dispatch(this, null);
        this.onDestroyed.clear();
    }

    #prefixMessageWithID(message: string): string {
        return ` [${this.constructor.name} "${this.id}"]: ${message}`;
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


