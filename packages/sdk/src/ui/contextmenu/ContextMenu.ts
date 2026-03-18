import { Map } from "../../utils/Map";

/**
 * Registry used to allocate and release unique {@link ContextMenu} IDs.
 */
const idMap = new Map();

/**
 * Callback invoked for a named menu event.
 *
 * @typeParam T - Event payload type.
 * @param value Event payload.
 */
type EventCallback<T = unknown> = (value: T) => void;

/**
 * Resolves an item title from the current menu context.
 *
 * @param context Current menu context.
 * @returns Item title.
 */
type ItemTitleGetter = (context: any) => string;

/**
 * Performs an item action using the current menu context.
 *
 * @param context Current menu context.
 */
type ItemAction = (context: any) => void;

/**
 * Resolves an item state from the current menu context.
 *
 * @param context Current menu context.
 * @returns State value.
 */
type ItemStateGetter = (context: any) => boolean;

/**
 * Resolves the root menu title from the current context.
 *
 * @param context Current menu context.
 * @returns Menu title.
 */
type MenuTitleGetter = (context: any) => string;

/**
 * Configuration for a single context-menu item.
 */
export interface ContextMenuItemConfig {
  /**
   * Static item title.
   *
   * Ignored when {@link getTitle} is provided.
   */
  title?: string;

  /**
   * Dynamic item title resolver.
   */
  getTitle?: ItemTitleGetter;

  /**
   * Action invoked when the item is activated.
   */
  doAction?: ItemAction;

  /**
   * Legacy alias for {@link doAction}.
   */
  callback?: ItemAction;

  /**
   * Optional action invoked when the pointer enters the item.
   */
  doHover?: ItemAction;

  /**
   * Resolves whether the item is enabled for the current context.
   *
   * Defaults to `true`.
   */
  getEnabled?: ItemStateGetter;

  /**
   * Resolves whether the item is shown for the current context.
   *
   * Defaults to `true`.
   */
  getShown?: ItemStateGetter;

  /**
   * Nested submenu item groups.
   *
   * Each inner array represents a visual group.
   */
  items?: ContextMenuItemConfig[][];
}

/**
 * Configuration for {@link ContextMenu}.
 */
export interface ContextMenuConfig {
  /**
   * Root menu item groups.
   */
  items?: ContextMenuItemConfig[][];

  /**
   * Arbitrary context object passed to item callbacks and resolvers.
   */
  context?: any | null;

  /**
   * Whether the menu starts enabled.
   *
   * Defaults to `true`.
   */
  enabled?: boolean;

  /**
   * Whether to hide the menu when a pointer-down occurs outside a menu item.
   *
   * Defaults to `true`.
   */
  hideOnMouseDown?: boolean;

  /**
   * Whether to hide the menu after an item action runs.
   *
   * Defaults to `true`.
   */
  hideOnAction?: boolean;

  /**
   * Parent DOM node that receives menu elements.
   *
   * Defaults to `document.body`.
   */
  parentNode?: Node;

  /**
   * Static title for the root menu.
   */
  title?: string;
}

/**
 * Internal state for a menu or submenu.
 *
 * @internal
 */
class Menu {
  /**
   * Unique menu ID.
   */
  id: string;

  /**
   * Parent item when this menu is a submenu.
   */
  parentItem: Item | null;

  /**
   * Item groups contained by this menu.
   */
  groups: Group[];

  /**
   * Root DOM element for this menu.
   */
  menuElement: HTMLDivElement | null;

  /**
   * Title DOM element for the root menu.
   */
  titleElement: HTMLDivElement | null;

  /**
   * Whether the menu is currently visible.
   */
  shown: boolean;

  /**
   * Reserved hover state counter.
   */
  mouseOver: number;

  /**
   * @param id Menu ID.
   */
  constructor(id: string) {
    this.id = id;
    this.parentItem = null;
    this.groups = [];
    this.menuElement = null;
    this.titleElement = null;
    this.shown = false;
    this.mouseOver = 0;
  }
}

/**
 * Internal item group within a menu.
 *
 * @internal
 */
class Group {
  /**
   * Items in this group.
   */
  items: Item[];

  constructor() {
    this.items = [];
  }
}

/**
 * Internal state for a context-menu item.
 *
 * @internal
 */
class Item {
  /**
   * Unique item ID.
   */
  id: string;

  /**
   * Resolves the display title.
   */
  getTitle: ItemTitleGetter;

  /**
   * Activation handler.
   */
  doAction: ItemAction;

  /**
   * Optional hover handler.
   */
  doHover?: ItemAction;

  /**
   * Resolves whether the item is enabled.
   */
  getEnabled: ItemStateGetter;

  /**
   * Resolves whether the item is visible.
   */
  getShown: ItemStateGetter;

  /**
   * DOM element for this item.
   */
  itemElement: HTMLElement | null;

  /**
   * Nested submenu, if any.
   */
  subMenu: Menu | null;

  /**
   * Cached enabled state.
   */
  enabled: boolean;

  /**
   * Cached shown state.
   */
  shown: boolean;

  /**
   * Parent menu containing this item.
   */
  parentMenu: Menu | null;

  /**
   * @param id Item ID.
   * @param getTitle Title resolver.
   * @param doAction Activation handler.
   * @param getEnabled Enabled-state resolver.
   * @param getShown Visibility resolver.
   */
  constructor(
    id: string,
    getTitle: ItemTitleGetter,
    doAction: ItemAction,
    getEnabled: ItemStateGetter,
    getShown: ItemStateGetter
  ) {
    this.id = id;
    this.getTitle = getTitle;
    this.doAction = doAction;
    this.getEnabled = getEnabled;
    this.getShown = getShown;
    this.itemElement = null;
    this.subMenu = null;
    this.enabled = true;
    this.shown = true;
    this.parentMenu = null;
  }
}

/**
 * UI context menu with support for grouped items, nested submenus,
 * context-sensitive titles, and context-sensitive enabled/visible state.
 *
 * Item actions and state resolvers receive the current {@link context}.
 */
class ContextMenu {
  private _id: string | null;
  private _context: any | null;
  private _enabled: boolean;
  private _itemsCfg: ContextMenuItemConfig[][];
  private _rootMenu: Menu | null;
  private _menuList: Menu[];
  private _menuMap: Record<string, Menu>;
  private _itemList: Item[];
  private _itemMap: Record<string, Item>;
  private _shown: boolean;
  private _nextId: number;
  private _parentNode: Node;
  private _offsetParent: HTMLElement;
  private _eventSubs: Record<string, EventCallback[]>;
  private _hideOnAction: boolean;
  private _canvasTouchStartHandler?: (event: TouchEvent) => void;
  private _title: string;
  private _getTitle: MenuTitleGetter;

  /**
   * Creates a context menu.
   *
   * @param cfg Menu configuration.
   */
  constructor(cfg: ContextMenuConfig = {}) {
    this._id = idMap.addItem();
    this._context = null;
    this._enabled = false;
    this._itemsCfg = [];
    this._rootMenu = null;
    this._menuList = [];
    this._menuMap = {};
    this._itemList = [];
    this._itemMap = {};
    this._shown = false;
    this._nextId = 0;
    this._parentNode = cfg.parentNode || document.body;
    this._offsetParent =
      this._parentNode instanceof ShadowRoot
        ? (this._parentNode.host as HTMLElement)
        : (this._parentNode as HTMLElement);

    this._eventSubs = {};
    this._title = cfg.title || "";
    this._getTitle = () => this._title;

    if (cfg.hideOnMouseDown !== false) {
      this._parentNode.addEventListener("mousedown", (event: Event) => {
        const target = event.target as Element | null;
        if (!target?.classList?.contains("xeokit-context-menu-item")) {
          this.hide();
        }
      });

      this._canvasTouchStartHandler = (event: TouchEvent) => {
        const target = event.target as Element | null;
        if (!target?.classList?.contains("xeokit-context-menu-item")) {
          this.hide();
        }
      };

      // @ts-ignore
      this._parentNode.addEventListener("touchstart", this._canvasTouchStartHandler);
    }

    if (cfg.items) {
      this.items = cfg.items;
    }

    this._hideOnAction = cfg.hideOnAction !== false;

    this.context = cfg.context ?? null;
    this.enabled = cfg.enabled !== false;
    this.hide();
  }

  /**
   * Subscribes to a menu event.
   *
   * Supported events currently include:
   * - `"shown"`
   * - `"hidden"`
   *
   * @param event Event name.
   * @param callback Subscriber callback.
   */
  on(event: string, callback: EventCallback): void {
    let subs = this._eventSubs[event];
    if (!subs) {
      subs = [];
      this._eventSubs[event] = subs;
    }
    subs.push(callback);
  }

  /**
   * Emits an event to current subscribers.
   *
   * @param event Event name.
   * @param value Event payload.
   */
  fire(event: string, value: unknown): void {
    const subs = this._eventSubs[event];
    if (subs) {
      for (let i = 0, len = subs.length; i < len; i++) {
        subs[i](value);
      }
    }
  }

  /**
   * Replaces the root menu item configuration and rebuilds the menu UI.
   */
  set items(itemsCfg: ContextMenuItemConfig[][]) {
    this._clear();
    this._itemsCfg = itemsCfg || [];
    this._parseItems(itemsCfg);
    this._createUI();
  }

  /**
   * Gets the current root menu item configuration.
   */
  get items(): ContextMenuItemConfig[][] {
    return this._itemsCfg;
  }

  /**
   * Enables or disables the menu.
   *
   * Disabling the menu also hides it.
   */
  set enabled(enabled: boolean) {
    enabled = !!enabled;
    if (enabled === this._enabled) {
      return;
    }
    this._enabled = enabled;
    if (!this._enabled) {
      this.hide();
    }
  }

  /**
   * Whether the menu is enabled.
   */
  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * Sets the context object used by item callbacks and state/title resolvers.
   */
  set context(context: any | null) {
    this._context = context;
  }

  /**
   * Gets the current context object.
   */
  get context(): any | null {
    return this._context;
  }

  /**
   * Sets the static root menu title and refreshes the visible title, if any.
   *
   * @param title New title.
   */
  setTitle(title: string): void {
    this._title = title || "";
    this._updateMenuTitle();
  }

  /**
   * Shows the root menu at the given page coordinates.
   *
   * The menu must have a non-null {@link context} and must be enabled.
   *
   * @param pageX Horizontal page coordinate.
   * @param pageY Vertical page coordinate.
   */
  show(pageX: number, pageY: number): void {
    if (!this._context) {
      console.error("ContextMenu cannot be shown without a context - set context first");
      return;
    }
    if (!this._enabled || this._shown || !this._rootMenu) {
      return;
    }

    this._hideAllMenus();
    this._updateMenuTitle();
    this._updateItemsTitles();
    this._updateItemsEnabledStatus();
    this._showMenu(this._rootMenu.id, pageX, pageY);
    this._updateSubMenuInfo();
    this._shown = true;
    this.fire("shown", {});
  }

  /**
   * Whether the menu is currently visible.
   */
  get shown(): boolean {
    return this._shown;
  }

  /**
   * Hides the root menu and all submenus.
   */
  hide(): void {
    if (!this._enabled || !this._shown) {
      return;
    }
    this._hideAllMenus();
    this._shown = false;
    this.fire("hidden", {});
  }

  /**
   * Destroys the menu and removes all generated DOM state.
   */
  destroy(): void {
    this._context = null;
    this._clear();
    if (this._id !== null) {
      idMap.removeItem(this._id);
      this._id = null;
    }
  }

  /**
   * Removes all menu UI and resets parsed menu state.
   */
  private _clear(): void {
    for (let i = 0, len = this._menuList.length; i < len; i++) {
      const menu = this._menuList[i];
      menu.menuElement?.remove();
    }
    this._itemsCfg = [];
    this._rootMenu = null;
    this._menuList = [];
    this._menuMap = {};
    this._itemList = [];
    this._itemMap = {};
  }

  /**
   * Parses nested item configuration into internal menu, group, and item objects.
   *
   * @param itemsCfg Root item groups.
   */
  private _parseItems(itemsCfg: ContextMenuItemConfig[][]): void {
    const visitItems = (itemsCfgToVisit: ContextMenuItemConfig[][]): Menu => {
      const menuId = this._getNextId();
      const menu = new Menu(menuId);

      for (let i = 0, len = itemsCfgToVisit.length; i < len; i++) {
        const itemsGroupCfg = itemsCfgToVisit[i];
        const group = new Group();
        menu.groups.push(group as unknown as Group);

        for (let j = 0, lenj = itemsGroupCfg.length; j < lenj; j++) {
          const itemCfg = itemsGroupCfg[j];
          const subItemsCfg = itemCfg.items;
          const hasSubItems = !!(subItemsCfg && subItemsCfg.length > 0);
          const itemId = this._getNextId();

          const getTitle: ItemTitleGetter =
            itemCfg.getTitle || (() => itemCfg.title || "");

          const doAction: ItemAction =
            itemCfg.doAction || itemCfg.callback || (() => {});

          const getEnabled: ItemStateGetter =
            itemCfg.getEnabled || (() => true);

          const getShown: ItemStateGetter =
            itemCfg.getShown || (() => true);

          const item = new Item(
            itemId,
            getTitle,
            doAction,
            getEnabled,
            getShown
          );

          item.doHover = itemCfg.doHover;
          item.parentMenu = menu;
          (group.items as Item[]).push(item);

          if (hasSubItems && subItemsCfg) {
            const subMenu = visitItems(subItemsCfg);
            item.subMenu = subMenu;
            subMenu.parentItem = item as unknown as Item;
          }

          this._itemList.push(item);
          this._itemMap[item.id] = item;
        }
      }

      this._menuList.push(menu);
      this._menuMap[menu.id] = menu;

      return menu;
    };

    this._rootMenu = visitItems(itemsCfg);
  }

  /**
   * Allocates the next internal menu or item ID.
   *
   * @returns Unique ID.
   */
  private _getNextId(): string {
    return `ContextMenu_${this._id}_${this._nextId++}`;
  }

  /**
   * Creates DOM for the root menu and all nested submenus.
   */
  private _createUI(): void {
    if (!this._rootMenu) {
      return;
    }

    const visitMenu = (menu: Menu): void => {
      this._createMenuUI(menu);

      const groups = menu.groups;
      for (let i = 0, len = groups.length; i < len; i++) {
        const group = groups[i] as Group;
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

    visitMenu(this._rootMenu);
  }

  /**
   * Creates DOM and event handlers for a single menu.
   *
   * @param menu Menu to render.
   */
  private _createMenuUI(menu: Menu): void {
    const groups = menu.groups as Group[];
    const html: string[] = [];

    const menuElement = document.createElement("div");
    menuElement.classList.add("xeokit-context-menu", menu.id);
    menuElement.style.zIndex = "300000";
    menuElement.style.position = "absolute";

    const isRootMenu = menu === this._rootMenu;

    if (isRootMenu) {
      html.push(`<div class="xeokit-context-menu-title"></div>`);
    }

    html.push("<ul>");

    for (let i = 0, len = groups.length; i < len; i++) {
      const group = groups[i];
      const groupIdx = i;
      const groupLen = len;
      const groupItems = group.items;

      for (let j = 0, lenj = groupItems.length; j < lenj; j++) {
        const item = groupItems[j];
        const itemSubMenu = item.subMenu;
        const actionTitle = "";

        if (itemSubMenu) {
          html.push(
            `<li id="${item.id}" class="xeokit-context-menu-item xeokit-context-menu-submenu">${actionTitle}</li>`
          );
        } else {
          html.push(
            `<li id="${item.id}" class="xeokit-context-menu-item">${actionTitle}</li>`
          );
        }

        if (!((groupIdx === groupLen - 1) || (j < lenj - 1))) {
          html.push(
            `<li id="${item.id}" class="xeokit-context-menu-item-separator"></li>`
          );
        }
      }
    }

    html.push("</ul>");

    menuElement.innerHTML = html.join("");
    this._parentNode.appendChild(menuElement);

    menu.menuElement = menuElement;
    menu.titleElement = menuElement.querySelector(
      ".xeokit-context-menu-title"
    ) as HTMLDivElement | null;

    menuElement.style.borderRadius = "4px";
    menuElement.style.display = "none";
    menuElement.style.zIndex = "300000";
    menuElement.style.background = "white";
    menuElement.style.border = "1px solid black";
    menuElement.style.boxShadow = "0 4px 5px 0 gray";
    menuElement.oncontextmenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    if (menu.titleElement) {
      menu.titleElement.style.padding = "8px 12px";
      menu.titleElement.style.fontWeight = "600";
      menu.titleElement.style.borderBottom = "1px solid #d9d9d9";
      menu.titleElement.style.whiteSpace = "nowrap";
      this._updateMenuTitle();
    }

    const self = this;
    let lastSubMenu: Menu | null = null;

    for (let i = 0, len = groups.length; i < len; i++) {
      const group = groups[i];
      const groupItems = group.items;

      for (let j = 0, lenj = groupItems.length; j < lenj; j++) {
        const item = groupItems[j];
        const itemSubMenu = item.subMenu;

        item.itemElement = menuElement.querySelector(`#${item.id}`) as HTMLElement | null;

        if (!item.itemElement) {
          console.error(`ContextMenu item element not found: ${item.id}`);
          continue;
        }

        item.itemElement.addEventListener("mouseenter", (event: MouseEvent) => {
          event.preventDefault();

          const subMenu = item.subMenu;
          if (!subMenu) {
            if (lastSubMenu) {
              self._hideMenu(lastSubMenu.id);
              lastSubMenu = null;
            }
            return;
          }

          if (lastSubMenu && lastSubMenu.id !== subMenu.id) {
            self._hideMenu(lastSubMenu.id);
            lastSubMenu = null;
          }

          if (item.enabled === false) {
            return;
          }

          const itemElement = item.itemElement!;
          const subMenuElement = subMenu.menuElement!;
          const itemRect = itemElement.getBoundingClientRect();
          subMenuElement.getBoundingClientRect();
          const offsetRect = self._offsetParent.getBoundingClientRect();

          const subMenuWidth = 200;
          const showOnRight = itemRect.right + subMenuWidth < offsetRect.right;
          const showOnLeft = itemRect.left - subMenuWidth > offsetRect.left;

          if (showOnRight) {
            self._showMenu(
              subMenu.id,
              itemRect.right + window.scrollX - 5,
              itemRect.top + window.scrollY - 16
            );
          } else if (showOnLeft) {
            self._showMenu(
              subMenu.id,
              itemRect.left - subMenuWidth + window.scrollX,
              itemRect.top + window.scrollY - 16
            );
          } else {
            const spaceOnLeft = itemRect.left - offsetRect.left;
            const spaceOnRight = offsetRect.right - itemRect.right;
            if (spaceOnRight > spaceOnLeft) {
              self._showMenu(
                subMenu.id,
                itemRect.right - 5 - (subMenuWidth - spaceOnRight),
                itemRect.top + window.scrollY - 16
              );
            } else {
              self._showMenu(
                subMenu.id,
                itemRect.left - spaceOnLeft,
                itemRect.top + window.scrollY - 16
              );
            }
          }

          lastSubMenu = subMenu;
        });

        if (!itemSubMenu) {
          item.itemElement.addEventListener("click", (event: MouseEvent) => {
            event.preventDefault();
            if (!self._context || item.enabled === false) {
              return;
            }
            item.doAction?.(self._context);
            if (this._hideOnAction) {
              self.hide();
            } else {
              self._updateMenuTitle();
              self._updateItemsTitles();
              self._updateItemsEnabledStatus();
            }
          });

          item.itemElement.addEventListener("mouseup", (event: MouseEvent) => {
            if (event.which !== 3) {
              return;
            }
            event.preventDefault();
            if (!self._context || item.enabled === false) {
              return;
            }
            item.doAction?.(self._context);
            if (this._hideOnAction) {
              self.hide();
            } else {
              self._updateMenuTitle();
              self._updateItemsTitles();
              self._updateItemsEnabledStatus();
            }
          });

          item.itemElement.addEventListener("mouseenter", (event: MouseEvent) => {
            event.preventDefault();
            if (!self._context || item.enabled === false) {
              return;
            }
            item.doHover?.(self._context);
          });
        }
      }
    }
  }

  /**
   * Refreshes the root menu title from the current title source.
   */
  private _updateMenuTitle(): void {
    if (!this._rootMenu?.titleElement) {
      return;
    }

    const title = this._context ? this._getTitle(this._context) : this._title;
    this._rootMenu.titleElement.innerText = title || "";
    this._rootMenu.titleElement.style.display = title ? "" : "none";
  }

  /**
   * Refreshes visible item titles from the current context.
   */
  private _updateItemsTitles(): void {
    if (!this._context) {
      return;
    }
    for (let i = 0, len = this._itemList.length; i < len; i++) {
      const item = this._itemList[i];
      const itemElement = item.itemElement;
      if (!itemElement) {
        continue;
      }
      const getShown = item.getShown;
      if (!getShown || !getShown(this._context)) {
        continue;
      }
      const title = item.getTitle(this._context);
      itemElement.innerText = title;
    }
  }

  /**
   * Refreshes item visibility and enabled state from the current context.
   */
  private _updateItemsEnabledStatus(): void {
    if (!this._context) {
      return;
    }
    for (let i = 0, len = this._itemList.length; i < len; i++) {
      const item = this._itemList[i];
      const itemElement = item.itemElement;
      if (!itemElement) {
        continue;
      }

      const shown = item.getShown(this._context);
      item.shown = shown;

      if (!shown) {
        itemElement.style.display = "none";
        continue;
      } else {
        itemElement.style.display = "";
      }

      const enabled = item.getEnabled(this._context);
      item.enabled = enabled;

      if (!enabled) {
        itemElement.classList.add("disabled");
      } else {
        itemElement.classList.remove("disabled");
      }
    }
  }

  /**
   * Updates submenu side metadata so CSS or UI logic can reflect placement.
   */
  private _updateSubMenuInfo(): void {
    if (!this._context) {
      return;
    }

    this._itemList.forEach((item) => {
      if (item.subMenu && item.itemElement && item.subMenu.menuElement) {
        const itemElement = item.itemElement;
        const itemRect = itemElement.getBoundingClientRect();
        const subMenuElement = item.subMenu.menuElement;

        const initialStyles = {
          visibility: subMenuElement.style.visibility,
          display: subMenuElement.style.display
        };

        subMenuElement.style.display = "block";
        subMenuElement.style.visibility = "hidden";

        const subMenuWidth = subMenuElement.getBoundingClientRect().width;

        subMenuElement.style.visibility = initialStyles.visibility;
        subMenuElement.style.display = initialStyles.display;

        const showOnLeft = itemRect.right + subMenuWidth > window.innerWidth;
        itemElement.setAttribute(
          "data-submenuposition",
          showOnLeft ? "left" : "right"
        );
      }
    });
  }

  /**
   * Shows the specified menu at the given page coordinates.
   *
   * @param menuId Menu ID.
   * @param pageX Horizontal page coordinate.
   * @param pageY Vertical page coordinate.
   */
  private _showMenu(menuId: string, pageX: number, pageY: number): void {
    const menu = this._menuMap[menuId];
    if (!menu) {
      console.error(`Menu not found: ${menuId}`);
      return;
    }
    if (menu.shown) {
      return;
    }
    const menuElement = menu.menuElement;
    if (menuElement) {
      this._showMenuElement(menuElement, pageX, pageY);
      menu.shown = true;
    }
  }

  /**
   * Hides the specified menu.
   *
   * @param menuId Menu ID.
   */
  private _hideMenu(menuId: string): void {
    const menu = this._menuMap[menuId];
    if (!menu) {
      console.error(`Menu not found: ${menuId}`);
      return;
    }
    if (!menu.shown) {
      return;
    }
    const menuElement = menu.menuElement;
    if (menuElement) {
      this._hideMenuElement(menuElement);
      menu.shown = false;
    }
  }

  /**
   * Hides all menus and submenus managed by this instance.
   */
  private _hideAllMenus(): void {
    for (let i = 0, len = this._menuList.length; i < len; i++) {
      const menu = this._menuList[i];
      this._hideMenu(menu.id);
    }
  }

  /**
   * Displays a menu element and constrains it within the offset parent bounds.
   *
   * @param menuElement Menu DOM element.
   * @param pageX Horizontal page coordinate.
   * @param pageY Vertical page coordinate.
   */
  private _showMenuElement(menuElement: HTMLElement, pageX: number, pageY: number): void {
    menuElement.style.display = "block";

    const menuHeight = menuElement.offsetHeight;
    const menuWidth = menuElement.offsetWidth;
    const offsetRect = this._offsetParent.getBoundingClientRect();

    const bottomContainerBorder =
      this._offsetParent === window.document.body && offsetRect.bottom === 0
        ? window.innerHeight
        : offsetRect.bottom + window.scrollY;

    const rightContainerBorder = offsetRect.right + window.scrollX;

    if (pageY + menuHeight > bottomContainerBorder) {
      pageY = bottomContainerBorder - menuHeight;
    }
    if (pageX + menuWidth > rightContainerBorder) {
      pageX = rightContainerBorder - menuWidth;
    }

    menuElement.style.left = `${pageX - offsetRect.left - window.scrollX}px`;
    menuElement.style.top = `${pageY - offsetRect.top - window.scrollY}px`;
  }

  /**
   * Hides a menu element.
   *
   * @param menuElement Menu DOM element.
   */
  private _hideMenuElement(menuElement: HTMLElement): void {
    menuElement.style.display = "none";
  }
}

export { ContextMenu };
