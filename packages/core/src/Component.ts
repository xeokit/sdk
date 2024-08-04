import {EventEmitter} from "./EventEmitter";
import {EventDispatcher} from "strongly-typed-events";

const createUUID = ((() => {
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
     * Emits an event when the {@link @xeokit/core!Component | Component} has been destroyed.
     *
     * @event
     */
    onDestroyed: EventEmitter<Component, null>;

    /**
     * Creates a new component.
     */
    constructor(owner: null | Component, cfg: { id?: string, [key: string]: any } = {}) {
        this.#owner = owner;
        this.id = cfg.id || createUUID();
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
        console.log(`[LOG] ${this.#prefixMessageWithID(message)}`);
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
        console.warn(`[WARN] ${this.#prefixMessageWithID(message)}`);
    }

    /**
     * Logs an error for this component to the JavaScript console.
     *
     * The console message will have this format: *````[ERROR] [<component type> =<component id>: <message>````*

     @param message The error message to log
     @protected
     */
    error(message: string): void {
        console.error(`[ERROR] ${this.#prefixMessageWithID(message)}`);
    }

    /**
     * Flags this component as having a defered state updates it needs to perform.
     */
    protected setDirty(): void {
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

