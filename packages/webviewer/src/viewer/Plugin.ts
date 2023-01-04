import type {WebViewer} from "./WebViewer";

/**
 * Base class for {@link WebViewer} plugins.
 */
abstract class Plugin {

    /**
     * Unique ID of this Plugin.
     */
    public readonly id: string;

    /**
     * The WebViewer that contains this Plugin.
     */
    public readonly viewer: WebViewer;

    /**
     * Creates this Plugin and installs it into the given {@link WebViewer}.
     *
     * @param id - ID for this plugin, unique among all plugins in the viewer.
     * @param viewer - The viewer.
     * @param [cfg] - Options
     */
    protected constructor(id: string, viewer: WebViewer, cfg?: {}) {

        this.id = id;
        this.viewer = viewer;

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
     * Destroys this Plugin and removes it from its {@link WebViewer}.
     */
    destroy() {
        this.viewer.deregisterPlugin(this);
    }
}

export {Plugin}