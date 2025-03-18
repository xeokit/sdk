import { EventEmitter } from "../core";
interface ItemParam {
}
/**
 * An HTML context menu.
 *
 * See {@link contextmenu | @xeokit/sdk/contextmenu} for usage.
 */
export declare class ContextMenu {
    #private;
    /**
     * Emits an event each time this ContextMenu is shown.
     *
     * @event
     */
    readonly onShown: EventEmitter<ContextMenu, null>;
    /**
     * Emits an event each time this ContextMenu is hidden.
     *
     * @event
     */
    readonly onHidden: EventEmitter<ContextMenu, null>;
    /**
     * Creates a ````ContextMenu````.
     *
     * The ````ContextMenu```` will be initially hidden.
     *
     * @param {Object} [cfg] ````ContextMenu```` configuration.
     * @param {Object} [cfg.items] The context menu items. These can also be dynamically set on {@link ContextMenu#items}. See the class documentation for an example.
     * @param {Object} [cfg.context] The context, which is passed into the item callbacks. This can also be dynamically set on {@link ContextMenu#context}. This must be set before calling {@link ContextMenu#show}.
     * @param {Boolean} [cfg.enabled=true] Whether this ````ContextMenu```` is initially enabled. {@link ContextMenu#show} does nothing while this is ````false````.
     * @param {Boolean} [cfg.hideOnMouseDown=true] Whether this ````ContextMenu```` automatically hides whenever we mouse-down or tap anywhere in the page.
     * @param {Boolean} [cfg.hideOnAction=true] Whether this ````ContextMenu```` automatically hides after we select a menu item. Se false if we want the menu to remain shown and show any updates to its item titles, after we've selected an item.
     */
    constructor(cfg: {
        enabled?: boolean;
        context: any;
        hideOnMouseDown?: boolean;
        items: ItemParam[];
        hideOnAction?: boolean;
    });
    /**
     * Sets the ````ContextMenu```` items.
     *
     * These can be updated dynamically at any time.
     *
     * See class documentation for an example.
     *
     * @type {Object[]}
     */
    set items(itemsCfg: any);
    /**
     * Gets the ````ContextMenu```` items.
     *
     * @type {Object[]}
     */
    get items(): any;
    /**
     * Sets whether this ````ContextMenu```` is enabled.
     *
     * Hides the menu when disabling.
     *
     * @type {Boolean}
     */
    set enabled(enabled: boolean);
    /**
     * Gets whether this ````ContextMenu```` is enabled.
     *
     * {@link ContextMenu#show} does nothing while this is ````false````.
     *
     * @type {Boolean}
     */
    get enabled(): boolean;
    /**
     * Sets the ````ContextMenu```` context.
     *
     * The context can be any object that you need to be provides to the callbacks configured on {@link ContextMenu#items}.
     *
     * This must be set before calling {@link ContextMenu#show}.
     *
     * @type {Object}
     */
    set context(context: any);
    /**
     * Gets the ````ContextMenu```` context.
     *
     * @type {Object}
     */
    get context(): any;
    /**
     * Shows this ````ContextMenu```` at the given page coordinates.
     *
     * Does nothing when {@link ContextMenu#enabled} is ````false````.
     *
     * Logs error to console and does nothing if {@link ContextMenu#context} has not been set.
     *
     * Fires a "shown" event when shown.
     *
     * @param {Number} pageX Page X-coordinate.
     * @param {Number} pageY Page Y-coordinate.
     */
    show(pageX: number, pageY: number): void;
    /**
     * Gets whether this ````ContextMenu```` is currently shown or not.
     *
     * @returns {Boolean} Whether this ````ContextMenu```` is shown.
     */
    get shown(): boolean;
    /**
     * Hides this ````ContextMenu````.
     *
     * Fires a "hidden" event when hidden.
     */
    hide(): void;
    /**
     * Destroys this ````ContextMenu````.
     */
    destroy(): void;
}
export {};
//# sourceMappingURL=ContextMenu.d.ts.map