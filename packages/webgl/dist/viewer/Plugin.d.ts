import type { WebViewer } from "./WebViewer";
/**
 * Base class for {@link WebViewer} plugins.
 */
declare abstract class Plugin {
    /**
     * Unique ID of this Plugin.
     */
    readonly id: string;
    /**
     * The WebViewer that contains this Plugin.
     */
    readonly viewer: WebViewer;
    /**
     * Creates this Plugin and installs it into the given {@link WebViewer}.
     *
     * @param id - ID for this plugin, unique among all plugins in the viewer.
     * @param viewer - The viewer.
     * @param [cfg] - Options
     */
    protected constructor(id: string, viewer: WebViewer, cfg?: {});
    /**
     * Logs a message to the JavaScript developer console, prefixed with the ID of this Plugin.
     *
     * @param msg - The message
     */
    log(msg: string): void;
    /**
     * Logs a warning message to the JavaScript developer console, prefixed with the ID of this Plugin.
     *
     * @param msg - The warning message
     */
    warn(msg: string): void;
    /**
     * Logs an error message to the JavaScript developer console, prefixed with the ID of this Plugin.
     *
     * @param msg - The error message
     */
    error(msg: string): void;
    /**
     * Sends a message to this Plugin.
     */
    send(name: string, value: any): void;
    /**
     * Clears this Plugin.
     */
    clear(): void;
    /**
     * Destroys this Plugin and removes it from its {@link WebViewer}.
     */
    destroy(): void;
}
export { Plugin };
