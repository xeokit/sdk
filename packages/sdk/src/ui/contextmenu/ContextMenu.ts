import { Map } from "../../base/utils/Map";

/**
 * Registry used to allocate and release unique {@link ContextMenu} IDs.
 */
const idMap = new Map();

const CONTEXT_MENU_STYLE_ID = "xeokit-context-menu-styles";

const CONTEXT_MENU_CSS = `
.xeokit-context-menu {
  position: absolute;
  /* int32 ceiling — sits above every floating panel regardless of
     how many times floatingPanelZ has bumped them. */
  z-index: 2147483647;
  display: none;
  min-width: 180px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  line-height: 1.45;
  color: #111;
}

.xeokit-context-menu ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.xeokit-context-menu-title {
  display: none;
  padding: 6px 10px;
  margin-bottom: 2px;
  font-weight: 600;
  color: #2d5e8c;
  white-space: nowrap;
  border-bottom: 1px solid #ececec;
}

.xeokit-context-menu-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  white-space: nowrap;
  user-select: none;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
}

.xeokit-context-menu-item:hover {
  background: #eef3f9;
  border-color: #c8d6e6;
}

.xeokit-context-menu-item.disabled {
  color: #999;
  cursor: default;
}

.xeokit-context-menu-item.disabled:hover {
  background: transparent;
  border-color: transparent;
}

.xeokit-context-menu-item-label {
  flex: 1;
  min-width: 0;
}

/* Icon column hidden until the wrapper opts in via the
   .xeokit-context-menu-with-icons class, so label-only menus
   don't reserve unused space. */
.xeokit-context-menu-item-icon {
  display: none;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  color: #2d5e8c;
}
.xeokit-context-menu-with-icons .xeokit-context-menu-item-icon {
  display: inline-flex;
}
.xeokit-context-menu-item-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.xeokit-context-menu-item.disabled .xeokit-context-menu-item-icon {
  color: #999;
}

.xeokit-context-menu-item-separator {
  height: 1px;
  margin: 4px 6px;
  background: #ececec;
  pointer-events: none;
}

.xeokit-context-menu-submenu {
  padding-right: 26px;
}

.xeokit-context-menu-submenu::after {
  content: "▶";
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 9px;
  color: #777;
}

.xeokit-context-menu-submenu[data-submenuposition="left"]::after {
  content: "◀";
}
`;

/**
 * Callback invoked for a named menu event.
 *
 * @typeParam T - Event payload type.
 * @param value Event payload.
 */
export type EventCallback<T = unknown> = (value: T) => void;

/**
 * Resolves an item title from the current menu context.
 *
 * @param context Current menu context.
 * @returns Item title.
 */
export type ItemTitleGetter = (context: any) => string;

/**
 * Performs an item action using the current menu context.
 *
 * @param context Current menu context.
 */
export type ItemAction = (context: any) => void;

/**
 * Resolves an item state from the current menu context.
 *
 * @param context Current menu context.
 * @returns State value.
 */
export type ItemStateGetter = (context: any) => boolean;

/**
 * Resolves an item icon from the current menu context. Returns
 * an SVG markup string (or `null` / empty for "no icon"). The
 * markup is dropped into the icon column via `innerHTML`, so it
 * must be trusted content. Stroke / fill colours that use
 * `currentColor` will pick up the icon column's text colour.
 *
 * @param context Current menu context.
 * @returns SVG markup, or null / empty when no icon should render.
 */
export type ItemIconGetter = (context: any) => string | null | undefined;

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
   * Optional icon for this item. Either a static SVG markup
   * string or a context-aware resolver returning one. The markup
   * is rendered via `innerHTML` into the menu's icon column —
   * stroke / fill colours that use `currentColor` will pick up
   * the menu's icon-column colour automatically.
   *
   * Items without an icon render normally; if at least one item
   * in a menu has an icon, every item in that menu reserves the
   * icon-column space so labels stay aligned.
   */
  icon?: string | ItemIconGetter;

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
   * Resolves the icon SVG markup, or `null` when no icon. Set
   * to `null` for items configured without an `icon`.
   */
  getIcon: ItemIconGetter | null;

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
    getShown: ItemStateGetter,
    getIcon: ItemIconGetter | null
  ) {
    this.id = id;
    this.getTitle = getTitle;
    this.doAction = doAction;
    this.getEnabled = getEnabled;
    this.getShown = getShown;
    this.getIcon = getIcon;
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
  private _document: Document;

  /**
   * Pending cascade-collapse timer. When the pointer leaves a
   * menu element a check is scheduled for ~200ms later (to allow
   * brief gaps while the cursor crosses between adjacent menus
   * in the cascade); entering any other menu in the cascade
   * before the timer fires cancels it. See {@link _scheduleCascadeCheck}.
   */
  private _pendingCascadeCheck: number | null = null;

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

    this._document =
      this._parentNode instanceof Document
        ? this._parentNode
        : this._parentNode.ownerDocument || document;

    this._ensureStylesInjected();

    this._eventSubs = {};
    this._title = cfg.title || "";
    this._getTitle = () => this._title;

    if (cfg.hideOnMouseDown !== false) {
      // Hide-on-outside-click. Use `closest()` rather than
      // `classList.contains()` on the literal target — every menu
      // row is now `<li><span class="…-icon"></span><span
      // class="…-label"></span></li>`, so a click target may be
      // the icon span, the label span, or an SVG inside the icon
      // span. A naive `target === LI` check would treat clicks
      // on inner spans as outside-the-menu clicks: the menu would
      // hide on `mousedown`, the LI's `click` handler would never
      // fire (because `mouseup` lands on whatever's underneath
      // the now-hidden menu, which fails the same-target rule
      // for synthesising `click`), and the residual `mouseup`
      // would reach the canvas and nudge the camera.
      this._parentNode.addEventListener("mousedown", (event: Event) => {
        const target = event.target as Element | null;
        if (!target?.closest?.(".xeokit-context-menu-item")) {
          this.hide();
        }
      });

      this._canvasTouchStartHandler = (event: TouchEvent) => {
        const target = event.target as Element | null;
        if (!target?.closest?.(".xeokit-context-menu-item")) {
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
   * Ensures required context-menu CSS exists in the current DOM root.
   *
   * Styles are injected once per document or shadow root.
   */
  private _ensureStylesInjected(): void {
    if (this._parentNode instanceof ShadowRoot) {
      const existingStyle = this._parentNode.querySelector(
        `style[data-xeokit-context-menu-style="${CONTEXT_MENU_STYLE_ID}"]`
      );
      if (existingStyle) {
        return;
      }

      const styleElement = this._document.createElement("style");
      styleElement.setAttribute("data-xeokit-context-menu-style", CONTEXT_MENU_STYLE_ID);
      styleElement.textContent = CONTEXT_MENU_CSS;
      this._parentNode.appendChild(styleElement);
      return;
    }

    if (this._document.getElementById(CONTEXT_MENU_STYLE_ID)) {
      return;
    }

    const styleElement = this._document.createElement("style");
    styleElement.id = CONTEXT_MENU_STYLE_ID;
    styleElement.textContent = CONTEXT_MENU_CSS;

    const target =
      this._document.head || this._document.body || this._document.documentElement;
    target.appendChild(styleElement);
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

  set items(itemsCfg: ContextMenuItemConfig[][]) {
    this._clear();
    this._itemsCfg = itemsCfg || [];
    this._parseItems(itemsCfg);
    this._createUI();
  }

  get items(): ContextMenuItemConfig[][] {
    return this._itemsCfg;
  }

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

  get enabled(): boolean {
    return this._enabled;
  }

  set context(context: any | null) {
    this._context = context;
  }

  get context(): any | null {
    return this._context;
  }

  setTitle(title: string): void {
    this._title = title || "";
    this._updateMenuTitle();
  }

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

  get shown(): boolean {
    return this._shown;
  }

  hide(): void {
    if (!this._enabled || !this._shown) {
      return;
    }
    this._cancelCascadeCheck();
    this._hideAllMenus();
    this._shown = false;
    this.fire("hidden", {});
  }

  destroy(): void {
    this._cancelCascadeCheck();
    this._context = null;
    this._clear();
    if (this._id !== null) {
      idMap.removeItem(this._id);
      this._id = null;
    }
  }

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

          const getIcon: ItemIconGetter | null =
            typeof itemCfg.icon === "function"
              ? itemCfg.icon as ItemIconGetter
              : typeof itemCfg.icon === "string"
                ? () => itemCfg.icon as string
                : null;

          const item = new Item(
            itemId,
            getTitle,
            doAction,
            getEnabled,
            getShown,
            getIcon
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

  private _getNextId(): string {
    return `ContextMenu_${this._id}_${this._nextId++}`;
  }

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

  private _createMenuUI(menu: Menu): void {
    const groups = menu.groups as Group[];
    const html: string[] = [];

    const menuElement = this._document.createElement("div");
    menuElement.classList.add("xeokit-context-menu", menu.id);

    const isRootMenu = menu === this._rootMenu;

    if (isRootMenu) {
      html.push(`<div class="xeokit-context-menu-title"></div>`);
    }

    // If any item in this menu carries an icon, every row in the
    // menu reserves the icon column so labels stay aligned. The
    // empty span on icon-less rows is laid out at the same width
    // as a real icon, just blank.
    let hasIcons = false;
    for (let i = 0; i < groups.length && !hasIcons; i++) {
      for (const item of groups[i].items) {
        if (item.getIcon) { hasIcons = true; break; }
      }
    }
    if (hasIcons) {
      menuElement.classList.add("xeokit-context-menu-with-icons");
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

        // Each row gets a structured `icon span + label span` so
        // the label-update path can write to its span without
        // clobbering the icon. When the menu has no icons at all
        // we still emit the spans for consistency — the icon
        // column is just hidden via the `:not(.with-icons)` CSS
        // rule below.
        const inner =
          `<span class="xeokit-context-menu-item-icon"></span>` +
          `<span class="xeokit-context-menu-item-label"></span>`;
        const submenuClass = itemSubMenu
          ? " xeokit-context-menu-submenu"
          : "";
        html.push(
          `<li id="${item.id}" class="xeokit-context-menu-item${submenuClass}">${inner}</li>`
        );

        if (!((groupIdx === groupLen - 1) || (j < lenj - 1))) {
          html.push(
            `<li class="xeokit-context-menu-item-separator"></li>`
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

    menuElement.oncontextmenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Cascade cleanup. `mouseenter` / `mouseleave` only fire on
    // the menu container (not bubbling from child items), so they
    // detect the pointer crossing the menu's outer boundary.
    // Leaving schedules a deferred collapse; entering ANY menu in
    // the cascade cancels a pending one — so brief gaps while the
    // cursor crosses between adjacent menus in a chain don't trip
    // the timer.
    menuElement.addEventListener("mouseenter", () => {
      this._cancelCascadeCheck();
    });
    menuElement.addEventListener("mouseleave", () => {
      this._scheduleCascadeCheck();
    });

    if (menu.titleElement) {
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

  private _updateMenuTitle(): void {
    if (!this._rootMenu?.titleElement) {
      return;
    }

    const title = this._context ? this._getTitle(this._context) : this._title;
    this._rootMenu.titleElement.innerText = title || "";
    this._rootMenu.titleElement.style.display = title ? "" : "none";
  }

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
      // Write into the structured spans rather than clobbering
      // the LI's innerText — the icon span needs to survive
      // every title update, and the LI also carries the
      // submenu-arrow `::after` styling.
      const labelEl = itemElement.querySelector(
        ".xeokit-context-menu-item-label"
      ) as HTMLElement | null;
      if (labelEl) {
        labelEl.innerText = item.getTitle(this._context);
      } else {
        // Fallback for any LI built before the structured
        // markup landed (none in current code, but defensive).
        itemElement.innerText = item.getTitle(this._context);
      }
      const iconEl = itemElement.querySelector(
        ".xeokit-context-menu-item-icon"
      ) as HTMLElement | null;
      if (iconEl) {
        const iconMarkup = item.getIcon
          ? item.getIcon(this._context) || ""
          : "";
        // Avoid an unnecessary innerHTML assignment when the
        // markup hasn't changed — keeps the GPU off the SVG
        // re-parse path on hover-driven re-renders.
        if (iconEl.innerHTML !== iconMarkup) {
          iconEl.innerHTML = iconMarkup;
        }
      }
    }
  }

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
      this._showMenuElement(menuElement, pageX, pageY+13);
      menu.shown = true;
    }
  }

  private _hideMenu(menuId: string): void {
    const menu = this._menuMap[menuId];
    if (!menu) {
      console.error(`Menu not found: ${menuId}`);
      return;
    }
    if (!menu.shown) {
      return;
    }
    // Cascade through descendants first so leaf menus disappear
    // before their parent does. Without this, hiding a mid-chain
    // menu (e.g. when the per-item `lastSubMenu` swap dismisses a
    // sibling branch) leaves any deeper submenus stranded — they
    // stay visible after their ancestor is gone, because the
    // per-item handler only references the immediate child it
    // tracks. Walking the subtree here makes "hide menu X" mean
    // "hide X and everything beneath it".
    for (const group of menu.groups) {
      for (const item of group.items) {
        if (item.subMenu && item.subMenu.shown) {
          this._hideMenu(item.subMenu.id);
        }
      }
    }
    const menuElement = menu.menuElement;
    if (menuElement) {
      this._hideMenuElement(menuElement);
      menu.shown = false;
    }
  }

  private _hideAllMenus(): void {
    for (let i = 0, len = this._menuList.length; i < len; i++) {
      const menu = this._menuList[i];
      this._hideMenu(menu.id);
    }
  }

  /**
   * Schedule a deferred cascade-collapse check. The 200 ms grace
   * period is enough to span the visual gap between a menu and
   * its child submenu when the pointer transits between them, but
   * short enough that genuinely abandoned cascades collapse
   * promptly.
   */
  private _scheduleCascadeCheck(): void {
    this._cancelCascadeCheck();
    this._pendingCascadeCheck = window.setTimeout(() => {
      this._pendingCascadeCheck = null;
      this._collapseUnhoveredCascade();
    }, 200);
  }

  private _cancelCascadeCheck(): void {
    if (this._pendingCascadeCheck != null) {
      window.clearTimeout(this._pendingCascadeCheck);
      this._pendingCascadeCheck = null;
    }
  }

  /**
   * Hide every open submenu deeper than the deepest menu the
   * pointer is currently hovering. With nothing in the cascade
   * hovered, every submenu collapses but the root is left for
   * the existing outside-mousedown path to dismiss.
   *
   * Depth is measured by walking `parentItem.parentMenu` upward
   * from each open menu — root sits at depth 0; its direct
   * children at depth 1, and so on.
   */
  private _collapseUnhoveredCascade(): void {
    const depthOf = (menu: Menu): number => {
      let d = 0;
      let m: Menu | null = menu;
      while (m && m.parentItem && m.parentItem.parentMenu) {
        d++;
        m = m.parentItem.parentMenu;
      }
      return d;
    };

    let deepestHoveredDepth = -1;
    for (const menu of this._menuList) {
      if (!menu.shown || !menu.menuElement) continue;
      // `:hover` is the cheapest way to ask "is the pointer
      // currently inside this element". Reliable on every modern
      // browser; updates synchronously with pointer movement.
      if (!menu.menuElement.matches(":hover")) continue;
      const d = depthOf(menu);
      if (d > deepestHoveredDepth) deepestHoveredDepth = d;
    }

    for (const menu of this._menuList) {
      if (!menu.shown) continue;
      if (menu === this._rootMenu) continue;
      if (depthOf(menu) > deepestHoveredDepth) {
        this._hideMenu(menu.id);
      }
    }
  }

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

  private _hideMenuElement(menuElement: HTMLElement): void {
    menuElement.style.display = "none";
  }
}

export { ContextMenu };
