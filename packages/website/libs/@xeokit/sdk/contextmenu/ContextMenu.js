import { Map } from "../utils";
import { EventEmitter } from "../core";
import { EventDispatcher } from "strongly-typed-events";
const idMap = new Map();
/**
 * Internal data class that represents the state of a menu or a submenu.
 * @private
 */
class Menu {
    id;
    parentItem;
    groups;
    menuElement;
    shown;
    mouseOver;
    constructor(id) {
        this.id = id;
        this.parentItem = null; // Set to an Item when this Menu is a submenu
        this.groups = [];
        this.menuElement = null;
        this.shown = false;
        this.mouseOver = 0;
    }
}
/**
 * Internal data class that represents a group of Items in a Menu.
 * @private
 */
class Group {
    items;
    constructor() {
        this.items = [];
    }
}
/**
 * Internal data class that represents the state of a menu item.
 * @private
 */
class Item {
    id;
    getTitle;
    doAction;
    getEnabled;
    getShown;
    itemElement;
    subMenu;
    enabled;
    parentMenu;
    shown;
    constructor(id, getTitle, doAction, getEnabled, getShown) {
        this.id = id;
        this.getTitle = getTitle;
        this.doAction = doAction;
        this.getEnabled = getEnabled;
        this.getShown = getShown;
        this.itemElement = null;
        this.subMenu = null;
        this.enabled = true;
    }
}
export class ContextMenu {
    #id;
    #itemList;
    #rootMenu;
    #menuList;
    #nextId;
    #shown;
    #itemMap;
    #menuMap;
    #itemsCfg;
    #enabled;
    #context;
    #hideOnAction;
    #canvasTouchStartHander;
    /**
     * Emits an event each time this ContextMenu is shown.
     *
     * @event
     */
    onShown;
    /**
     * Emits an event each time this ContextMenu is hidden.
     *
     * @event
     */
    onHidden;
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
    constructor(cfg) {
        this.#id = idMap.addItem();
        this.#context = null;
        this.#enabled = false; // True when the ContextMenu is enabled
        this.#itemsCfg = []; // Items as given as configs
        this.#rootMenu = null; // The root Menu in the tree
        this.#menuList = []; // List of Menus
        this.#menuMap = {}; // Menus mapped to their IDs
        this.#itemList = []; // List of Items
        this.#itemMap = {}; // Items mapped to their IDs
        this.#shown = false; // True when the ContextMenu is visible
        this.#nextId = 0;
        this.onShown = new EventEmitter(new EventDispatcher());
        this.onHidden = new EventEmitter(new EventDispatcher());
        if (cfg.hideOnMouseDown !== false) {
            document.addEventListener("mousedown", (event) => {
                if (!event.target.classList.contains("xeokit-context-menu-item")) {
                    this.hide();
                }
            });
            document.addEventListener("touchstart", this.#canvasTouchStartHander = (event) => {
                if (!event.target.classList.contains("xeokit-context-menu-item")) {
                    this.hide();
                }
            });
        }
        if (cfg.items) {
            this.items = cfg.items;
        }
        this.#hideOnAction = (cfg.hideOnAction !== false);
        this.context = cfg.context;
        this.enabled = cfg.enabled !== false;
        this.hide();
    }
    /**
     * Sets the ````ContextMenu```` items.
     *
     * These can be updated dynamically at any time.
     *
     * See class documentation for an example.
     *
     * @type {Object[]}
     */
    set items(itemsCfg) {
        this.#clear();
        this.#itemsCfg = itemsCfg || [];
        this.#parseItems(itemsCfg);
        this.#createUI();
    }
    /**
     * Gets the ````ContextMenu```` items.
     *
     * @type {Object[]}
     */
    get items() {
        return this.#itemsCfg;
    }
    /**
     * Sets whether this ````ContextMenu```` is enabled.
     *
     * Hides the menu when disabling.
     *
     * @type {Boolean}
     */
    set enabled(enabled) {
        enabled = (!!enabled);
        if (enabled === this.#enabled) {
            return;
        }
        this.#enabled = enabled;
        if (!this.#enabled) {
            this.hide();
        }
    }
    /**
     * Gets whether this ````ContextMenu```` is enabled.
     *
     * {@link ContextMenu#show} does nothing while this is ````false````.
     *
     * @type {Boolean}
     */
    get enabled() {
        return this.#enabled;
    }
    /**
     * Sets the ````ContextMenu```` context.
     *
     * The context can be any object that you need to be provides to the callbacks configured on {@link ContextMenu#items}.
     *
     * This must be set before calling {@link ContextMenu#show}.
     *
     * @type {Object}
     */
    set context(context) {
        this.#context = context;
    }
    /**
     * Gets the ````ContextMenu```` context.
     *
     * @type {Object}
     */
    get context() {
        return this.#context;
    }
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
    show(pageX, pageY) {
        if (!this.#context) {
            console.error("[ContextMenu] ContextMenu cannot be shown without a context - set context first");
            return;
        }
        if (!this.#enabled) {
            return;
        }
        if (this.#shown) {
            return;
        }
        this.#hideAllMenus();
        this.#updateItemsTitles();
        this.#updateItemsEnabledStatus();
        this.#showMenu(this.#rootMenu.id, pageX, pageY);
        this.#shown = true;
        this.onShown.dispatch(this, null);
    }
    /**
     * Gets whether this ````ContextMenu```` is currently shown or not.
     *
     * @returns {Boolean} Whether this ````ContextMenu```` is shown.
     */
    get shown() {
        return this.#shown;
    }
    /**
     * Hides this ````ContextMenu````.
     *
     * Fires a "hidden" event when hidden.
     */
    hide() {
        if (!this.#enabled) {
            return;
        }
        if (!this.#shown) {
            return;
        }
        this.#hideAllMenus();
        this.#shown = false;
        this.onHidden.dispatch(this, null);
    }
    /**
     * Destroys this ````ContextMenu````.
     */
    destroy() {
        this.#context = null;
        this.#clear();
        if (this.#id !== null) {
            idMap.removeItem(this.#id);
            this.#id = null;
        }
    }
    #clear() {
        for (let i = 0, len = this.#menuList.length; i < len; i++) {
            const menu = this.#menuList[i];
            const menuElement = menu.menuElement;
            menuElement.parentElement.removeChild(menuElement);
        }
        this.#itemsCfg = [];
        this.#rootMenu = null;
        this.#menuList = [];
        this.#menuMap = {};
        this.#itemList = [];
        this.#itemMap = {};
    }
    #parseItems(itemsCfg) {
        const visitItems = (itemsCfg) => {
            const menuId = this.#getNextId();
            const menu = new Menu(menuId);
            for (let i = 0, len = itemsCfg.length; i < len; i++) {
                const itemsGroupCfg = itemsCfg[i];
                const group = new Group();
                menu.groups.push(group);
                for (let j = 0, lenj = itemsGroupCfg.length; j < lenj; j++) {
                    const itemCfg = itemsGroupCfg[j];
                    const subItemsCfg = itemCfg.items;
                    const hasSubItems = (subItemsCfg && (subItemsCfg.length > 0));
                    const itemId = this.#getNextId();
                    const getTitle = itemCfg.getTitle || (() => {
                        return (itemCfg.title || "");
                    });
                    const doAction = itemCfg.doAction || itemCfg.callback || (() => {
                    });
                    const getEnabled = itemCfg.getEnabled || (() => {
                        return true;
                    });
                    const getShown = itemCfg.getShown || (() => {
                        return true;
                    });
                    const item = new Item(itemId, getTitle, doAction, getEnabled, getShown);
                    item.parentMenu = menu;
                    group.items.push(item);
                    if (hasSubItems) {
                        const subMenu = visitItems(subItemsCfg);
                        item.subMenu = subMenu;
                        subMenu.parentItem = item;
                    }
                    this.#itemList.push(item);
                    this.#itemMap[item.id] = item;
                }
            }
            this.#menuList.push(menu);
            this.#menuMap[menu.id] = menu;
            return menu;
        };
        this.#rootMenu = visitItems(itemsCfg);
    }
    #getNextId() {
        return "ContextMenu_" + this.#id + "_" + this.#nextId++; // Start ID with alpha chars to make a valid DOM element selector
    }
    #createUI() {
        const visitMenu = (menu) => {
            this.#createMenuUI(menu);
            const groups = menu.groups;
            for (let i = 0, len = groups.length; i < len; i++) {
                const group = groups[i];
                const groupItems = group.items;
                for (let j = 0, lenj = groupItems.length; j < lenj; j++) {
                    const item = groupItems[j];
                    const subMenu = item.subMenu;
                    if (subMenu) {
                        visitMenu(subMenu);
                    }
                }
            }
        };
        visitMenu(this.#rootMenu);
    }
    #createMenuUI(menu) {
        const groups = menu.groups;
        const html = [];
        html.push('<div class="xeokit-context-menu ' + menu.id + '" style="z-index:300000; position: absolute;">');
        html.push('<ul>');
        if (groups) {
            for (let i = 0, len = groups.length; i < len; i++) {
                const group = groups[i];
                const groupIdx = i;
                const groupLen = len;
                const groupItems = group.items;
                if (groupItems) {
                    for (let j = 0, lenj = groupItems.length; j < lenj; j++) {
                        const item = groupItems[j];
                        const itemSubMenu = item.subMenu;
                        const actionTitle = item.title || "";
                        if (itemSubMenu) {
                            html.push(`<li id="${item.id}" class="xeokit-context-menu-item"
                                style="${((groupIdx === groupLen - 1) || ((j < lenj - 1)) ? 'border-bottom: 0' : 'border-bottom: 1px solid black')}">
                                ${actionTitle} [MORE]</li>`);
                        }
                        else {
                            html.push('<li id="' + item.id + '" class="xeokit-context-menu-item" style="' +
                                ((groupIdx === groupLen - 1) || ((j < lenj - 1)) ? 'border-bottom: 0' : 'border-bottom: 1px solid black') +
                                '">' +
                                actionTitle +
                                '</li>');
                        }
                    }
                }
            }
        }
        html.push('</ul>');
        html.push('</div>');
        const htmlString = html.join("");
        document.body.insertAdjacentHTML('beforeend', htmlString);
        const menuElement = document.querySelector("." + menu.id);
        menu.menuElement = menuElement;
        menuElement.style["border-radius"] = 4 + "px";
        menuElement.style.display = 'none';
        menuElement.style["z-index"] = 300000;
        menuElement.style.background = "white";
        menuElement.style.border = "1px solid black";
        menuElement.style["box-shadow"] = "0 4px 5px 0 gray";
        menuElement.oncontextmenu = (e) => {
            e.preventDefault();
        };
        // Bind event handlers
        let lastSubMenu = null;
        if (groups) {
            for (let i = 0, len = groups.length; i < len; i++) {
                const group = groups[i];
                const groupItems = group.items;
                if (groupItems) {
                    for (let j = 0, lenj = groupItems.length; j < lenj; j++) {
                        const item = groupItems[j];
                        const itemSubMenu = item.subMenu;
                        item.itemElement = document.getElementById(item.id);
                        if (!item.itemElement) {
                            console.error("[ContextMenu] ContextMenu item element not found: " + item.id);
                            continue;
                        }
                        item.itemElement.addEventListener("mouseenter", (event) => {
                            event.preventDefault();
                            const subMenu = item.subMenu;
                            if (!subMenu) {
                                if (lastSubMenu) {
                                    this.#hideMenu(lastSubMenu.id);
                                    lastSubMenu = null;
                                }
                                return;
                            }
                            if (lastSubMenu && (lastSubMenu.id !== subMenu.id)) {
                                this.#hideMenu(lastSubMenu.id);
                                lastSubMenu = null;
                            }
                            if (item.enabled === false) {
                                return;
                            }
                            const itemElement = item.itemElement;
                            const subMenuElement = subMenu.menuElement;
                            const itemRect = itemElement.getBoundingClientRect();
                            const menuRect = subMenuElement.getBoundingClientRect();
                            const subMenuWidth = 200; // TODO
                            const showOnLeft = ((itemRect.right + subMenuWidth) > window.innerWidth);
                            if (showOnLeft) {
                                this.#showMenu(subMenu.id, itemRect.left - subMenuWidth, itemRect.top - 1);
                            }
                            else {
                                this.#showMenu(subMenu.id, itemRect.right - 5, itemRect.top - 1);
                            }
                            lastSubMenu = subMenu;
                        });
                        if (!itemSubMenu) {
                            // Item without sub-menu
                            // clicking item fires the item's action callback
                            item.itemElement.addEventListener("click", (event) => {
                                event.preventDefault();
                                if (!this.#context) {
                                    return;
                                }
                                if (item.enabled === false) {
                                    return;
                                }
                                if (item.doAction) {
                                    item.doAction(this.#context);
                                }
                                if (this.#hideOnAction) {
                                    this.hide();
                                }
                                else {
                                    this.#updateItemsTitles();
                                    this.#updateItemsEnabledStatus();
                                }
                            });
                            item.itemElement.addEventListener("mouseup", (event) => {
                                if (event.which !== 3) {
                                    return;
                                }
                                event.preventDefault();
                                if (!this.#context) {
                                    return;
                                }
                                if (item.enabled === false) {
                                    return;
                                }
                                if (item.doAction) {
                                    item.doAction(this.#context);
                                }
                                if (this.#hideOnAction) {
                                    this.hide();
                                }
                                else {
                                    this.#updateItemsTitles();
                                    this.#updateItemsEnabledStatus();
                                }
                            });
                            item.itemElement.addEventListener("mouseenter", (event) => {
                                event.preventDefault();
                                if (item.enabled === false) {
                                    return;
                                }
                                if (item.doHover) {
                                    item.doHover(this.#context);
                                }
                            });
                        }
                    }
                }
            }
        }
    }
    #updateItemsTitles() {
        if (!this.#context) {
            return;
        }
        for (let i = 0, len = this.#itemList.length; i < len; i++) {
            const item = this.#itemList[i];
            const itemElement = item.itemElement;
            if (!itemElement) {
                continue;
            }
            const getShown = item.getShown;
            if (!getShown || !getShown(this.#context)) {
                continue;
            }
            const title = item.getTitle(this.#context);
            if (item.subMenu) {
                itemElement.innerText = title;
            }
            else {
                itemElement.innerText = title;
            }
        }
    }
    #updateItemsEnabledStatus() {
        if (!this.#context) {
            return;
        }
        for (let i = 0, len = this.#itemList.length; i < len; i++) {
            const item = this.#itemList[i];
            const itemElement = item.itemElement;
            if (!itemElement) {
                continue;
            }
            const getEnabled = item.getEnabled;
            if (!getEnabled) {
                continue;
            }
            const getShown = item.getShown;
            if (!getShown) {
                continue;
            }
            const shown = getShown(this.#context);
            item.shown = shown;
            if (!shown) {
                itemElement.style.visibility = "hidden";
                itemElement.style.height = "0";
                itemElement.style.padding = "0";
                continue;
            }
            else {
                itemElement.style.visibility = "visible";
                itemElement.style.height = "auto";
                itemElement.style.padding = null;
            }
            const enabled = getEnabled(this.#context);
            item.enabled = enabled;
            if (!enabled) {
                itemElement.classList.add("disabled");
            }
            else {
                itemElement.classList.remove("disabled");
            }
        }
    }
    #showMenu(menuId, pageX, pageY) {
        const menu = this.#menuMap[menuId];
        if (!menu) {
            console.error("[ContextMenu] Menu not found: " + menuId);
            return;
        }
        if (menu.shown) {
            return;
        }
        const menuElement = menu.menuElement;
        if (menuElement) {
            this.#showMenuElement(menuElement, pageX, pageY);
            menu.shown = true;
        }
    }
    #hideMenu(menuId) {
        const menu = this.#menuMap[menuId];
        if (!menu) {
            console.error("[ContextMenu] Menu not found: " + menuId);
            return;
        }
        if (!menu.shown) {
            return;
        }
        const menuElement = menu.menuElement;
        if (menuElement) {
            this.#hideMenuElement(menuElement);
            menu.shown = false;
        }
    }
    #hideAllMenus() {
        for (let i = 0, len = this.#menuList.length; i < len; i++) {
            const menu = this.#menuList[i];
            this.#hideMenu(menu.id);
        }
    }
    #showMenuElement(menuElement, pageX, pageY) {
        menuElement.style.display = 'block';
        const menuHeight = menuElement.offsetHeight;
        const menuWidth = menuElement.offsetWidth;
        if ((pageY + menuHeight) > window.innerHeight) {
            pageY = window.innerHeight - menuHeight;
        }
        if ((pageX + menuWidth) > window.innerWidth) {
            pageX = window.innerWidth - menuWidth;
        }
        menuElement.style.left = pageX + 'px';
        menuElement.style.top = pageY + 'px';
    }
    #hideMenuElement(menuElement) {
        menuElement.style.display = 'none';
    }
}
//# sourceMappingURL=ContextMenu.js.map