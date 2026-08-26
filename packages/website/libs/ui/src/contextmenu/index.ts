/**
 * # xeokit Context Menu
 *
 * ---
 *
 * **Customisable HTML context menu — dynamically configured menu
 * items, per-item enabled / shown predicates, cascading sub-menus,
 * and CSS-restylable chrome.**
 *
 * ---
 *
 * [<img src="http://xeokit.io/img/docs/ContextMenu/ContextMenu.gif">](https://xeokit.github.io/xeokit-sdk/examples/index.html#ContextMenu_Canvas_TreeViewPlugin_Custom)
 *
 * The `contextmenu` module ships a pure-DOM context menu with a
 * declarative item-config API. Each item carries a `title`, an
 * optional `doAction(context)` callback, and optional
 * `getEnabled(context)` / `getShown(context)` predicates that fire
 * every time the menu opens, so the same menu can adapt its visible
 * items to whatever was right-clicked.
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class ContextMenu {
 *       +context     : any
 *       +enabled     : boolean
 *       +items       : ContextMenuItemConfig[][]
 *       +show(x, y)
 *       +hide()
 *       +on(event, callback)
 *       +destroy()
 *     }
 *     class ContextMenuConfig {
 *       +items?           : ContextMenuItemConfig[][]
 *       +context?         : any
 *       +enabled?         : boolean
 *       +hideOnMouseDown? : boolean
 *       +hideOnAction?    : boolean
 *       +parentNode?      : Node
 *       +title?           : string
 *     }
 *     class ContextMenuItemConfig {
 *       +title?      : string
 *       +getTitle?   : ItemTitleGetter
 *       +icon?       : string | ItemIconGetter
 *       +doAction?   : ItemAction
 *       +doHover?    : ItemAction
 *       +getEnabled? : ItemStateGetter
 *       +getShown?   : ItemStateGetter
 *       +items?      : ContextMenuItemConfig[][]
 *     }
 *     ContextMenu ..> ContextMenuConfig : reads
 *     ContextMenu "1" *-- "*" ContextMenuItemConfig
 *     ContextMenuItemConfig "1" *-- "*" ContextMenuItemConfig : sub-menu
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Declarative item config** — group items into nested arrays;
 *   each inner array becomes a visual section.
 * - **Per-item predicates** — `getEnabled(context)` and
 *   `getShown(context)` fire every time the menu opens, so the
 *   same menu adapts to whichever object was right-clicked.
 * - **Cascading sub-menus** — an item's own `items: [[…]]`
 *   creates a nested menu that opens on hover; nests arbitrarily
 *   deep.
 * - **Per-item icons** — `icon` accepts a static SVG markup
 *   string or a `(context) => svg` resolver; markup is dropped
 *   into the icon column via `innerHTML` and inherits the column's
 *   text colour through `currentColor`.
 * - **Per-item hover actions** — `doHover(context)` fires when
 *   the pointer enters an item, useful for previewing the action
 *   (e.g. highlight the target object before clicking).
 * - **CSS-restylable** — every selector is rooted at
 *   `.xeokit-context-menu`; override colours / typography / spacing
 *   without touching SDK code.
 * - **Auto-positioning** — `show(x, y)` repositions the menu when
 *   it would overflow the viewport, keeping every item visible.
 * - **Hide-on-action / hide-on-mousedown-outside** — both
 *   configurable via `ContextMenuConfig`.
 *
 * <br>
 *
 * # Installation
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * # Usage
 *
 * In the example below we'll create a ````ContextMenu```` that pops up whenever we right-click on an object within
 * our {@link model!scene.Scene | Scene}.
 *
 * First, we'll create the ````ContextMenu````, configuring it with a list of menu items.
 *
 * Each item has:
 *
 * * a ````title```` for the item,
 * * a ````doAction()```` callback to fire when the item's title is clicked,
 * * an optional ````getShown()```` callback that indicates if the item should shown in the menu or not, and
 * * an optional ````getEnabled()```` callback that indicates if the item should be shown enabled in the menu or not.
 *
 * <br>
 *
 * The ````getShown()```` and ````getEnabled()```` callbacks are invoked whenever the menu is shown.
 *
 * When an item's ````getShown()```` callback
 * returns ````true````, then the item is shown. When it returns ````false````, then the item is hidden. An item without
 * a ````getShown()```` callback is always shown.
 *
 * When an item's ````getEnabled()```` callback returns ````true````, then the item is enabled and clickable (as long as it's also shown). When it
 * returns ````false````, then the item is disabled and cannot be clicked. An item without a ````getEnabled()````
 * callback is always enabled and clickable.
 *
 * Note how the ````doAction()````,  ````getShown()```` and ````getEnabled()```` callbacks accept a ````context````
 * object. That must be set on the ````ContextMenu```` before we're able to we show it. The context object can be anything. In this example,
 * we'll use the context object to provide the callbacks with the Entity that we right-clicked.
 *
 * We'll also initially enable the ````ContextMenu````.
 *
 * ````javascript
 * const canvasContextMenu = new ContextMenu({
 *
 *    enabled: true,
 *
 *    items: [
 *       [
 *          {
 *             title: "Hide Object",
 *             getEnabled: (context) => {
 *                 return context.entity.visible; // Can't hide entity if already hidden
 *             },
 *             doAction: function (context) {
 *                 context.entity.visible = false;
 *             }
 *          }
 *       ],
 *       [
 *          {
 *             title: "Select Object",
 *             getEnabled: (context) => {
 *                 return (!context.entity.selected); // Can't select an entity that's already selected
 *             },
 *             doAction: function (context) {
 *                 context.entity.selected = true;
 *             }
 *          }
 *       ],
 *       [
 *          {
 *             title: "X-Ray Object",
 *             getEnabled: (context) => {
 *                 return (!context.entity.xrayed); // Can't X-ray an entity that's already X-rayed
 *             },
 *             doAction: (context) => {
 *                 context.entity.xrayed = true;
 *             }
 *          }
 *       ]
 *    ]
 * });
 * ````
 *
 * Next, we'll make the ````ContextMenu```` appear whenever we right-click on an Entity. Whenever we right-click
 * on the canvas, we'll attempt to pick the Entity at those mouse coordinates. If we succeed, we'll feed the
 * Entity into ````ContextMenu```` via the context object, then show the ````ContextMenu````.
 *
 * From there, each ````ContextMenu```` item's ````getEnabled()```` callback will be invoked (if provided), to determine if the item should
 * be enabled. If we click an item, its ````doAction()```` callback will be invoked with our context object.
 *
 * Remember that we must set the context on our ````ContextMenu```` before we show it, otherwise it will log an error to the console,
 * and ignore our attempt to show it.
 *
 * ````javascript*
 * viewer.scene.canvas.canvas.oncontextmenu = (e) => { // Right-clicked on the canvas
 *
 *     if (!objectContextMenu.enabled) {
 *         return;
 *     }
 *
 *     var hit = viewer.scene.pick({ // Try to pick an Entity at the coordinates
 *         canvasPos: [e.pageX, e.pageY]
 *     });
 *
 *     if (hit) { // Picked an Entity
 *
 *         objectContextMenu.context = { // Feed entity to ContextMenu
 *             entity: hit.entity
 *         };
 *
 *         objectContextMenu.show(e.pageX, e.pageY); // Show the ContextMenu
 *     }
 *
 *     e.preventDefault();
 * });
 * ````
 *
 * Note how we only show the ````ContextMenu```` if it's enabled. We can use that mechanism to switch between multiple
 * ````ContextMenu```` instances depending on what we clicked.
 *
 * ## Dynamic Item Titles
 *
 * To make an item dynamically regenerate its title text whenever we show the ````ContextMenu````, provide its title with a
 * ````getTitle()```` callback. The callback will fire each time you show ````ContextMenu````, which will dynamically
 * set the item title text.
 *
 * In the example below, we'll create a simple ````ContextMenu```` that allows us to toggle the selection of an object
 * via its first item, which changes text depending on whether we are selecting or deselecting the object.
 *
 * ````javascript
 * const canvasContextMenu = new ContextMenu({
 *
 *    enabled: true,
 *
 *    items: [
 *       [
 *          {
 *              getTitle: (context) => {
 *                  return (!context.entity.selected) ? "Select" : "Undo Select";
 *              },
 *              doAction: function (context) {
 *                  context.entity.selected = !context.entity.selected;
 *              }
 *          },
 *          {
 *              title: "Clear Selection",
 *              getEnabled: function (context) {
 *                  return (context.viewer.scene.numSelectedObjects > 0);
 *              },
 *              doAction: function (context) {
 *                  context.viewer.scene.setObjectsSelected(context.viewer.scene.selectedObjectIds, false);
 *              }
 *          }
 *       ]
 *    ]
 * });
 * ````
 *
 * ## Sub-menus
 *
 * Each menu item can optionally have a sub-menu, which will appear when we hover over the item.
 *
 * In the example below, we'll create a much simpler ````ContextMenu```` that has only one item, called "Effects", which
 * will open a cascading sub-menu whenever we hover over that item.
 *
 * Note that our "Effects" item has no ````doAction```` callback, because an item with a sub-menu performs no
 * action of its own.
 *
 * ````javascript
 * const canvasContextMenu = new ContextMenu({
 *     items: [ // Top level items
 *         [
 *             {
 *                 getTitle: (context) => {
 *                     return "Effects";
 *                 },
 *
 *                 items: [ // Sub-menu
 *                     [
 *                         {
 *                             getTitle: (context) => {
 *                                 return (!context.entity.visible) ? "Show" : "Hide";
 *                             },
 *                             doAction: function (context) {
 *                                 context.entity.visible = !context.entity.visible;
 *                             }
 *                         },
 *                         {
 *                             getTitle: (context) => {
 *                                 return (!context.entity.selected) ? "Select" : "Undo Select";
 *                             },
 *                             doAction: function (context) {
 *                                 context.entity.selected = !context.entity.selected;
 *                             }
 *                         },
 *                         {
 *                             getTitle: (context) => {
 *                                 return (!context.entity.highlighted) ? "Highlight" : "Undo Highlight";
 *                             },
 *                             doAction: function (context) {
 *                                 context.entity.highlighted = !context.entity.highlighted;
 *                             }
 *                         }
 *                     ]
 *                 ]
 *             }
 *          ]
 *      ]
 * });
 * ````
 *
 * @module contextmenu
 */

export * from "./ContextMenu";
