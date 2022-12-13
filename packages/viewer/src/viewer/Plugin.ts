import type {Viewer} from "./Viewer";
import {Events} from "./Events";

/**
 * Base class for {@link Viewer} plugins.
 */
abstract class Plugin {

    /**
     * Unique ID of this Plugin.
     */
    public readonly id: string;

    /**
     * The Viewer that contains this Plugin.
     */
    public readonly viewer: Viewer;

    /**
     * Manages events on this Plugin.
     */
    public readonly events: Events;

    /**
     * Creates this Plugin and installs it into the given {@link Viewer}.
     *
     * @param id - ID for this plugin, unique among all plugins in the viewer.
     * @param viewer - The viewer.
     * @param [cfg] - Options
     */
    protected constructor(id: string, viewer: Viewer, cfg?: {}) {

        this.id = id;
        this.viewer = viewer;
        this.events = new Events();

        viewer.registerPlugin(this);
    }

    /**
     * Logs a message to the JavaScript developer console, prefixed with the ID of this Plugin.
     *
     * @param msg - The message
     */
    log(msg: string) {
        console.log(`[xeokit plugin ${this.id}]: ${msg}`);
    }

    /**
     * Logs a warning message to the JavaScript developer console, prefixed with the ID of this Plugin.
     *
     * @param msg - The warning message
     */
    warn(msg: string) {
        console.warn(`[xeokit plugin ${this.id}]: ${msg}`);
    }

    /**
     * Logs an error message to the JavaScript developer console, prefixed with the ID of this Plugin.
     *
     * @param msg - The error message
     */
    error(msg: string) {
        console.error(`[xeokit plugin ${this.id}]: ${msg}`);
    }

    /**
     * Sends a message to this Plugin.
     */
    send(name: string, value: any) {
        //...
    }

    /**
     * Clears this Plugin.
     */
    clear() {

    }

    /**
     * Destroys this Plugin and removes it from its {@link Viewer}.
     */
    destroy() {
        this.viewer.deregisterPlugin(this);
    }
}

export {Plugin}