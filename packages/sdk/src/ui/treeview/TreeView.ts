import {EventEmitter, SDKInternalException} from "../../core";
import type {Data, DataModel, DataObject} from "../../data";
import type {View, Viewer, ViewObject} from "../../viewer";
import type {TreeViewNode} from "./TreeViewNode";
import type {TreeViewNodeContextMenuEvent} from "./TreeViewNodeContextMenuEvent";
import type {TreeViewNodeTitleClickedEvent} from "./TreeViewNodeTitleClickedEvent";
import type {TreeViewParams} from "./TreeViewParams";
import {TreeViewEvents} from "./TreeViewEvents";

const TREE_VIEW_STYLE_ELEMENT_ID = "xeokit-treeview-styles";

/** Crosshair / target glyph for the per-row Select button —
 *  evokes "pick this object". Uses `currentColor` so it tracks
 *  the button's accent on hover. */
const SELECT_ICON_SVG =
  `<svg viewBox="0 0 16 16" aria-hidden="true">` +
    `<circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.4"/>` +
    `<line x1="8" y1="0.5" x2="8"  y2="3.5"  stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>` +
    `<line x1="8" y1="12.5" x2="8" y2="15.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>` +
    `<line x1="0.5" y1="8" x2="3.5"  y2="8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>` +
    `<line x1="12.5" y1="8" x2="15.5" y2="8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>` +
    `<circle cx="8" cy="8" r="1.4" fill="currentColor"/>` +
  `</svg>`;

/** Frame-/zoom-to-fit glyph: four corner brackets boxing a
 *  region — universal "frame the selection in the camera". */
const FRAME_ICON_SVG =
  `<svg viewBox="0 0 16 16" aria-hidden="true">` +
    `<path d="M 1.5 5 V 1.5 H 5 M 11 1.5 H 14.5 V 5 M 14.5 11 V 14.5 H 11 M 5 14.5 H 1.5 V 11" ` +
          `fill="none" stroke="currentColor" stroke-width="1.4" ` +
          `stroke-linecap="round" stroke-linejoin="round"/>` +
  `</svg>`;

/**
 * Default DOM styles for TreeView.
 *
 * These styles are injected once into <head> the first time a TreeView is constructed.
 * The styles target a dedicated container class that TreeView adds to its container element,
 * which makes this safe as a drop-in replacement without requiring consumers to remember to
 * load a separate stylesheet.
 */
const TREE_VIEW_CSS = `
  .xeokit-tree-view {
    color: #1f2937;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 12.5px;
    line-height: 1.4;
  }

  /* Indentation. Each nested <ul> adds a fixed amount; the
     amount is large enough that descendants are visually well
     inside their parent regardless of whether the parent has a
     toggle button or not. */
  .xeokit-tree-view ul {
    list-style: none;
    margin: 0;
    padding-left: 18px;
    position: relative;
  }
  .xeokit-tree-view > ul {
    padding-left: 0;
  }

  /* Subtle vertical guide line per nested level — sits in the
     ul's padding-left column. Skipped on the outer ul. */
  .xeokit-tree-view ul ul::before {
    content: "";
    position: absolute;
    left: 8px;
    top: 4px;
    bottom: 4px;
    width: 1px;
    background: rgba(99, 116, 139, 0.18);
    pointer-events: none;
  }

  /* Each row reserves a 24px-wide column on its left for the
     expand/collapse toggle. The toggle itself is absolutely
     positioned into that column when present; leaf rows keep
     the column reserved so their labels line up with
     toggle-bearing siblings. We deliberately keep \`li\` as
     \`display: block\` (not flex) — child \`<ul>\` elements
     for expanded subtrees are direct children and need to
     flow below the row, not next to it. */
  .xeokit-tree-view li {
    position: relative;
    display: block;
    white-space: nowrap;
    margin: 1px 0;
    padding: 2px 6px 2px 24px;
    border-radius: 5px;
    min-height: 22px;
  }

  .xeokit-tree-view li:hover {
    background: rgba(37, 99, 235, 0.05);
  }

  /* Toggle is absolutely positioned into the 24px reserved
     column on its row's left. Pinned to \`top: 2px\` (not
     centered) because an expanded \`<li>\` also contains its
     children's \`<ul>\` — vertical-centering would drag the
     toggle down into the middle of the expanded subtree. */
  .xeokit-tree-view a.plus,
  .xeokit-tree-view a.minus {
    position: absolute;
    left: 1px;
    top: 2px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    text-decoration: none;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    color: #475569;
    background: #f1f5f9;
    border: 1px solid rgba(148, 163, 184, 0.32);
    transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
    box-sizing: border-box;
    cursor: pointer;
  }
  .xeokit-tree-view a.plus:hover,
  .xeokit-tree-view a.minus:hover {
    background: #e0e7ff;
    border-color: rgba(37, 99, 235, 0.45);
    color: #2563eb;
  }

  .xeokit-tree-view input[type="checkbox"] {
    appearance: none;
    -webkit-appearance: none;
    display: inline-block;
    width: 14px;
    height: 14px;
    margin: 0 5px 0 0;
    vertical-align: -3px;
    border-radius: 3px;
    border: 1px solid rgba(100, 116, 139, 0.45);
    background: white;
    position: relative;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease;
  }
  .xeokit-tree-view input[type="checkbox"]:checked {
    background: #2563eb;
    border-color: #2563eb;
  }
  .xeokit-tree-view input[type="checkbox"]:checked::after {
    content: "";
    position: absolute;
    left: 3px;
    top: 0;
    width: 4px;
    height: 8px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }

  .xeokit-tree-view span {
    display: inline-block;
    vertical-align: middle;
    padding: 1px 4px;
    border-radius: 4px;
    cursor: pointer;
    color: #1f2937;
    font-weight: 500;
    letter-spacing: -0.005em;
  }
  .xeokit-tree-view li:hover > span {
    color: #0f172a;
  }

  .xeokit-tree-view .highlighted-node > span {
    background: #dbeafe;
    color: #1d4ed8;
    font-weight: 600;
  }

  .xeokit-tree-view .xrayed-node > span {
    opacity: 0.55;
    font-style: italic;
  }

  /* Per-row action buttons (Select + Frame). Hidden by
     default — surfaced on row hover (or when the row contains
     a focused button) so they don't clutter quiet scrolling.
     Click handlers stop propagation so they never fire the
     row's title-click / context-menu event by accident. */
  .xeokit-tree-view .xeokit-tree-view-row-actions {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    margin-left: 4px;
    vertical-align: middle;
    opacity: 0;
    transition: opacity 100ms ease-out;
    pointer-events: none;
  }
  .xeokit-tree-view li:hover > .xeokit-tree-view-row-actions,
  .xeokit-tree-view li:focus-within > .xeokit-tree-view-row-actions {
    opacity: 1;
    pointer-events: auto;
  }
  .xeokit-tree-view button.xeokit-tree-view-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    color: #475569;
    background: #f1f5f9;
    border: 1px solid rgba(148, 163, 184, 0.32);
    border-radius: 4px;
    cursor: pointer;
    line-height: 1;
    transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
  }
  .xeokit-tree-view button.xeokit-tree-view-action:hover {
    background: #e0e7ff;
    border-color: rgba(37, 99, 235, 0.45);
    color: #2563eb;
  }
  .xeokit-tree-view button.xeokit-tree-view-action:focus-visible {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.20);
  }
  .xeokit-tree-view button.xeokit-tree-view-action svg {
    width: 12px;
    height: 12px;
    pointer-events: none;
  }
`;

/**
 * An HTMl tree view that navigates the {@link data!DataObject | DataObjects} in the given
 * {@link data!Data | Data}, while controlling the visibility of their corresponding
 * {@link viewer!ViewObject | ViewObjects} in the given {@link viewer!View | View}.
 *
 * See {@link ui/treeview | @xeokit/sdk/treeview} for usage.
 */
export class TreeView {

  /**
   * Hierarchy mode that arranges the {@link TreeViewNode | TreeViewNodes} as an aggregation hierarchy.
   *
   * The mode creates a TreeViewNode hierarchy that mirrors that of the
   * {@link data!DataObject | DataObjects} and
   * aggregation {@link data!Relationship | Relationships} in the {@link data!Data | Data}.
   *
   * In this hierarchy, each TreeViewNode corresponds to a DataObject in the Data. The TreeViewNodes are connected
   * into a hierarchy that reflects a depth-first traversal from the root DataObjects that follows each DataObject's
   * outgoing Relationships of the type given in {@link TreeView.linkType | TreeView.linkType}.
   */
  static AggregationHierarchy = 0;

  /**
   * Hierarchy mode that groups the {@link TreeViewNode | TreeViewNodes} by type.
   *
   * This mode creates a two-level hierarchy. At the root level, we get TreeViewNodes that represent each of the
   * distinct types in our {@link data!Data | Data}. Each of those gets one or more child TreeViewNodes
   * that represent {@link data!DataObject | DataObjects} of that type. When those DataObjects have
   * {@link viewer!ViewObject | ViewObjects} of the same ID, then the TreeViewNodes will have checkboxes
   * that we can use to show, hide, and X-ray their ViewObjects.
   */
  static TypesHierarchy = 1;

  /**
   * Hierarchy mode that arranges the {@link TreeViewNode | TreeViewNodes} into an n-level grouped hierarchy.
   *
   * This mode creates a multi-level grouped hierarchy, following the order given
   * in {@link TreeViewParams.groupTypes | TreeViewParams.groupTypes}. The TreeViewNodes at level 0 are all the same
   * type as ````TreeViewParams.groupTypes[0]````, TreeViewNodes at level 1 are all the same type
   * as ````TreeViewParams.groupTypes[1]````, and so on. Once descended beyond the length of
   * ````TreeViewParams.groupTypes````, the TreeViewNodes are grouped by type.
   */
  static GroupsHierarchy = 2;

  /**
   * The events emitted by this TreeView.
   */
  public readonly events: TreeViewEvents;

  /**
   * The semantic {@link data!Data | Data} model that determines the structure of this TreeView.
   */
  public readonly data: Data;

  /**
   * The {@link viewer!View | View} that contains the {@link viewer!ViewObject | ViewObjects}
   * navigated by this TreeView.
   */
  public readonly view: View;

  _linkTypes: string[];
  _groupTypes: string[];
  _containerElement: HTMLElement;
  _hierarchy: number;
  _dataModels: { [key: string]: DataModel };
  _autoAddModels: boolean;
  _autoExpandDepth: number;
  _sortNodes: boolean | undefined;
  _pruneEmptyNodes: boolean;
  _viewer: Viewer;
  _rootElement: HTMLUListElement | null;
  _muteSceneEvents: boolean;
  _muteTreeEvents: boolean;
  _rootNodes: TreeViewNode[];
  _objectNodes: { [key: string]: TreeViewNode };
  _rootName: any;
  _showListItemElementId: string | null;
  _spatialSortFunc: ((node1: TreeViewNode, node2: TreeViewNode) => number) | null;
  _switchExpandHandler: (event: MouseEvent) => void;
  _switchCollapseHandler: (event: MouseEvent) => void;
  _checkboxChangeHandler: (event: Event) => void;
  _destroyed: boolean;
  _ownsContainerElement: boolean;

  private _onSceneModelCreated: () => void;
  private _onSceneModelDestroyed: () => void;
  private _onViewObjectVisibility: () => void;
  private _onViewObjectXRayed: () => void;
  private _onDataObjectCreated: () => void;
  private _onDataObjectDestroyed: () => void;

  private _dataObjectSceneObjectCounts: { [key: string]: number };
  private _groupNodeIndex: { [key: string]: TreeViewNode };
  private _typeRootNodeIndex: { [key: string]: TreeViewNode };
  private _groupsTypeNodeIndex: { [key: string]: TreeViewNode };

  /**
   * @param params
   */
  constructor(params: TreeViewParams) {

    if (!params.data) {
      throw new Error("Config expected: data");
    }

    if (!params.view) {
      throw new Error("Config expected: view");
    }

    this.events = params.events || new TreeViewEvents();
    this.data = params.data;
    this.view = params.view;

    this._viewer = params.view.viewer;
    this._linkTypes = Array.isArray(params.linkType) ? params.linkType : [params.linkType];
    this._groupTypes = params.groupTypes || [];
    this._hierarchy = TreeView.AggregationHierarchy;
    this._containerElement = params.containerElement || this._createDefaultContainerElement();
    this._dataModels = {};
    this._autoAddModels = true;
    this._autoExpandDepth = (params.autoExpandDepth || 0);
    this._sortNodes = (params.sortNodes !== false);
    this._pruneEmptyNodes = (params.pruneEmptyNodes !== false);
    this._rootElement = null;
    this._muteSceneEvents = false;
    this._muteTreeEvents = false;
    this._rootNodes = [];
    this._objectNodes = {};
    this._rootName = params.rootName;
    this._showListItemElementId = null;
    this._destroyed = false;
    this._spatialSortFunc = null;
    this._ownsContainerElement = !params.containerElement;

    this._dataObjectSceneObjectCounts = {};
    this._groupNodeIndex = {};
    this._typeRootNodeIndex = {};
    this._groupsTypeNodeIndex = {};

    this._ensureStyles();
    this._containerElement.classList.add("xeokit-tree-view");

    this._containerElement.oncontextmenu = (e) => {
      e.preventDefault();
    };

    this._onViewObjectVisibility = this.view.viewer.events.onViewObjectVisibleChanged.subscribe((view: View, viewObject: ViewObject) => {
      if (this._muteSceneEvents) {
        return;
      }
      const objectId = viewObject.id;
      const node = this._objectNodes[objectId];
      if (!node) {
        return;
      }
      const visible = viewObject.visible;
      if (visible === node.checked && ((visible && node.numVisibleViewObjects > 0) || (!visible && node.numVisibleViewObjects === 0))) {
        return;
      }

      this._muteTreeEvents = true;

      node.checked = visible;
      node.numVisibleViewObjects = visible ? node.numViewObjects : 0;

      const checkbox = document.getElementById(node.nodeId) as HTMLInputElement | null;
      if (checkbox) {
        checkbox.checked = visible;
      }

      let parentNode = node.parentNode;
      while (parentNode) {
        if (visible) {
          parentNode.numVisibleViewObjects++;
        } else {
          parentNode.numVisibleViewObjects--;
          if (parentNode.numVisibleViewObjects < 0) {
            parentNode.numVisibleViewObjects = 0;
          }
        }
        parentNode.checked = parentNode.numVisibleViewObjects > 0;

        const parentCheckbox = document.getElementById(parentNode.nodeId) as HTMLInputElement | null;
        if (parentCheckbox) {
          parentCheckbox.checked = parentNode.checked;
        }
        parentNode = parentNode.parentNode;
      }

      this._muteTreeEvents = false;
    });

    this._onViewObjectXRayed = this.view.viewer.events.onViewObjectXRayedChanged.subscribe((view: View, viewObject: ViewObject) => {
      if (this._muteSceneEvents) {
        return;
      }
      const objectId = viewObject.id;
      const node = this._objectNodes[objectId];
      if (!node) {
        return;
      }

      const xrayed = viewObject.xrayed;
      if (xrayed === node.xrayed) {
        return;
      }

      this._muteTreeEvents = true;
      node.xrayed = xrayed;

      const listItemElementId = "node-" + node.nodeId;
      const listItemElement = document.getElementById(listItemElementId);
      if (listItemElement) {
        if (xrayed) {
          listItemElement.classList.add("xrayed-node");
        } else {
          listItemElement.classList.remove("xrayed-node");
        }
      }
      this._muteTreeEvents = false;
    });

    this._switchExpandHandler = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const switchElement = event.target as HTMLElement;
      this._expandSwitchElement(switchElement);
    };

    this._switchCollapseHandler = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const switchElement = event.target as HTMLElement;
      this._collapseSwitchElement(switchElement);
    };

    this._checkboxChangeHandler = (event: Event) => {
      if (this._muteTreeEvents) {
        return;
      }

      this._muteSceneEvents = true;

      const checkbox = event.target as HTMLInputElement;
      const visible = checkbox.checked;
      const nodeId = checkbox.id;
      const checkedNode = this._objectNodes[nodeId];
      if (!checkedNode) {
        this._muteSceneEvents = false;
        return;
      }

      const objects = this.view.objects;
      let numUpdatedLeaves = 0;

      this._withNodeTree(checkedNode, (node: TreeViewNode) => {
        const objectId = node.objectId;
        const viewObject = objects[objectId];
        const isLeaf = (node.childNodes.length === 0);

        node.numVisibleViewObjects = visible ? node.numViewObjects : 0;
        if (isLeaf && viewObject && (visible !== node.checked)) {
          numUpdatedLeaves++;
        }
        node.checked = visible;

        const checkbox2 = document.getElementById(node.nodeId) as HTMLInputElement | null;
        if (checkbox2) {
          checkbox2.checked = visible;
        }

        if (viewObject) {
          viewObject.visible = visible;
        }
      });

      let parentNode = checkedNode.parentNode;
      while (parentNode) {
        if (visible) {
          parentNode.numVisibleViewObjects += numUpdatedLeaves;
        } else {
          parentNode.numVisibleViewObjects -= numUpdatedLeaves;
          if (parentNode.numVisibleViewObjects < 0) {
            parentNode.numVisibleViewObjects = 0;
          }
        }
        parentNode.checked = parentNode.numVisibleViewObjects > 0;

        const checkbox2 = document.getElementById(parentNode.nodeId) as HTMLInputElement | null;
        if (checkbox2) {
          checkbox2.checked = parentNode.checked;
        }
        parentNode = parentNode.parentNode;
      }

      this._muteSceneEvents = false;
    };

    this.hierarchy = params.hierarchy;

    const modelIds = Object.keys(this.data.models);
    for (let i = 0, len = modelIds.length; i < len; i++) {
      this._addModel(modelIds[i]);
    }

    this._onSceneModelCreated = this._viewer.scene.events.onSceneModelCreated.subscribe((scene: any, sceneModel: any) => {
      if (this.data.models[sceneModel.id]) {
        this._addModel(sceneModel.id);
      }
    });

    this._onSceneModelDestroyed = this._viewer.scene.events.onSceneModelDestroyed.subscribe((scene: any, sceneModel: any) => {
      if (this.data.models[sceneModel.id]) {
        this._removeModel(sceneModel.id);
      }
    });

    this._onDataObjectCreated = this.data.events.onDataObjectCreated.subscribe((data: Data, dataObject: DataObject) => {
      if (this._destroyed || !dataObject) {
        return;
      }
      this._handleDataObjectCreated(dataObject);
    });

    this._onDataObjectDestroyed = this.data.events.onDataObjectDestroyed.subscribe((data: Data, dataObject: DataObject) => {
      if (this._destroyed || !dataObject) {
        return;
      }
      this._handleDataObjectDestroyed(dataObject);
    });
  }

  /**
   * Gets how the nodes are organized within this tree view.
   */
  get hierarchy(): number {
    return this._hierarchy;
  }

  /**
   * Sets how the nodes are organized within this tree view.
   */
  set hierarchy(hierarchy: number) {
    hierarchy = (hierarchy !== null && hierarchy !== undefined) ? hierarchy : TreeView.AggregationHierarchy;
    if (hierarchy !== TreeView.AggregationHierarchy && hierarchy !== TreeView.GroupsHierarchy && hierarchy !== TreeView.TypesHierarchy) {
      console.error("Unsupported value for `hierarchy' - defaulting to TreeView.AggregationHierarchy ");
      hierarchy = TreeView.AggregationHierarchy;
    }
    if (this._hierarchy === hierarchy) {
      return;
    }
    this._hierarchy = hierarchy;
    this._rebuildNodes();
  }

  /**
   * When traversing the {@link data!Data | Data} to build the tree UI nodes, at each
   * {@link data!DataObject | DataObjects}, the TreeView will traverse only the outgoing
   * {@link data!Relationship | Relationships} of this type in
   * {@link data!DataObject.relating | DataObject.relating}.
   */
  get linkType(): string | string[] {
    return this._linkTypes.length === 1 ? this._linkTypes[0] : this._linkTypes;
  }

  /**
   * When traversing the {@link data!Data | Data} to build the tree UI nodes, at each
   * {@link data!DataObject | DataObjects}, the TreeView will traverse only the outgoing
   * {@link data!Relationship | Relationships} of this type in
   * {@link data!DataObject.relating | DataObject.relating}.
   */
  set linkType(linkType: string | string[]) {
    const next = Array.isArray(linkType) ? linkType : [linkType];
    if (next.length === this._linkTypes.length && next.every((t, i) => t === this._linkTypes[i])) {
      return;
    }
    this._linkTypes = next;
    this._rebuildNodes();
  }

  /**
   * Grouping types for {@link TreeView.GroupsHierarchy}.
   */
  get groupTypes(): string[] {
    return this._groupTypes;
  }

  /**
   * Grouping types for {@link TreeView.GroupsHierarchy}.
   */
  set groupTypes(groupTypes: string[]) {
    if (this._groupTypes === groupTypes) {
      return;
    }
    this._groupTypes = groupTypes || [];
    if (this._hierarchy === TreeView.GroupsHierarchy) {
      this._rebuildNodes();
    }
  }

  /**
   * Highlights the tree view node that represents the given object {@link view!ViewObject | ViewObject}.
   */
  showNode(objectId: string): void {
    if (this._showListItemElementId) {
      this.unShowNode();
    }
    const node = this._objectNodes[objectId];
    if (!node) {
      return;
    }
    const nodeId = node.nodeId;
    const switchElementId = "switch-" + nodeId;
    const switchElement = document.getElementById(switchElementId);
    if (switchElement) {
      this._expandSwitchElement(switchElement as HTMLElement);
      switchElement.scrollIntoView();
      return;
    }

    const path: TreeViewNode[] = [];
    path.unshift(node);
    let parentNode = node.parentNode;
    while (parentNode) {
      path.unshift(parentNode);
      parentNode = parentNode.parentNode;
    }

    for (let i = 0, len = path.length; i < len; i++) {
      const pathNode = path[i];
      const pathNodeId = pathNode.nodeId;
      const pathSwitchElementId = "switch-" + pathNodeId;
      const pathSwitchElement = document.getElementById(pathSwitchElementId);
      if (pathSwitchElement) {
        this._expandSwitchElement(pathSwitchElement as HTMLElement);
      }
    }

    const listItemElementId = "node-" + nodeId;
    const listItemElement = document.getElementById(listItemElementId);
    if (!listItemElement) {
      return;
    }
    (listItemElement as any).scrollIntoView({block: "center"});
    listItemElement.classList.add("highlighted-node");
    this._showListItemElementId = listItemElementId;
  }

  /**
   * De-highlights the node previously shown with {@link TreeView_showNode}.
   */
  unShowNode(): void {
    if (!this._showListItemElementId) {
      return;
    }
    const listItemElement = document.getElementById(this._showListItemElementId);
    if (!listItemElement) {
      this._showListItemElementId = null;
      return;
    }
    listItemElement.classList.remove("highlighted-node");
    this._showListItemElementId = null;
  }

  /**
   * Expands the tree to the given depth.
   */
  expandToDepth(depth: number): void {
    this.collapse();

    const expand = (node: TreeViewNode, countDepth: number) => {
      if (countDepth === depth) {
        return;
      }
      const nodeId = node.nodeId;
      const switchElementId = `switch-${nodeId}`;
      const switchElement = document.getElementById(switchElementId);
      if (switchElement) {
        this._expandSwitchElement(switchElement as HTMLElement);
        const childNodes = node.childNodes;
        for (let i = 0, len = childNodes.length; i < len; i++) {
          expand(childNodes[i], countDepth + 1);
        }
      }
    };

    for (let i = 0, len = this._rootNodes.length; i < len; i++) {
      expand(this._rootNodes[i], 0);
    }
  }

  /**
   * Closes all the nodes in the tree.
   */
  collapse(): void {
    for (let i = 0, len = this._rootNodes.length; i < len; i++) {
      this._collapseNode(this._rootNodes[i].objectId);
    }
  }

  /**
   * Destroys this TreeView.
   */
  destroy(): void {
    if (!this._containerElement || this._destroyed) {
      return;
    }

    this._dataModels = {};

    if (this._rootElement && this._rootElement.parentNode) {
      this._rootElement.parentNode.removeChild(this._rootElement);
    }
    this._rootElement = null;

    const sceneEvents = this.view.viewer.scene.events;
    sceneEvents.onSceneModelCreated.unsubscribe(this._onSceneModelCreated);
    sceneEvents.onSceneModelDestroyed.unsubscribe(this._onSceneModelDestroyed);

    const viewerEvents = this.view.viewer.events;
    viewerEvents.onViewObjectVisibleChanged.unsubscribe(this._onViewObjectVisibility);
    viewerEvents.onViewObjectXRayedChanged.unsubscribe(this._onViewObjectXRayed);

    this.data.events.onDataObjectCreated.unsubscribe(this._onDataObjectCreated);
    this.data.events.onDataObjectDestroyed.unsubscribe(this._onDataObjectDestroyed);

    this._containerElement.classList.remove("xeokit-tree-view");

    if (this._ownsContainerElement && this._containerElement.parentNode) {
      this._containerElement.parentNode.removeChild(this._containerElement);
    }

    this._destroyed = true;
    this.events.destroy();
  }

  /**
   * Adds a model to this tree view.
   */
  _addModel(modelId: string, options = {}): void {
    if (!this._containerElement) {
      return;
    }
    const model = this._viewer.scene.models[modelId];
    if (!model) {
      throw new SDKInternalException(`SceneModel not found: ${modelId}`);
    }
    const dataModel = this.data.models[modelId];
    if (!dataModel) {
      throw new SDKInternalException(`DataModel not found: ${modelId}`);
    }
    if (this._dataModels[modelId]) {
      throw new SDKInternalException(`Model already added: ${modelId}`);
    }
    this._dataModels[modelId] = dataModel;
    this._rebuildNodes();
  }

  /**
   * Removes a model from this tree view.
   */
  _removeModel(modelId: string): void {
    if (!this._containerElement) {
      return;
    }
    const dataModel = this._dataModels[modelId];
    if (!dataModel) {
      return;
    }
    delete this._dataModels[modelId];
    this._rebuildNodes();
  }

  _rebuildNodes(): void {
    if (this._rootElement && this._rootElement.parentNode) {
      this._rootElement.parentNode.removeChild(this._rootElement);
      this._rootElement = null;
    }

    this._rootNodes = [];
    this._objectNodes = {};
    this._dataObjectSceneObjectCounts = {};
    this._groupNodeIndex = {};
    this._typeRootNodeIndex = {};
    this._groupsTypeNodeIndex = {};

    this._createEnabledNodes();
  }

  _handleDataObjectCreated(dataObject: DataObject): void {
    if (!this._containerElement || this._objectNodes[dataObject.id]) {
      return;
    }

    if (this._pruneEmptyNodes) {
      this._recomputePruneCounts();
    }

    switch (this._hierarchy) {
      case TreeView.TypesHierarchy:
        this._insertTypesNode(dataObject);
        break;
      case TreeView.GroupsHierarchy:
        this._insertGroupsNode(dataObject);
        break;
      case TreeView.AggregationHierarchy:
      default:
        this._insertAggregationNode(dataObject);
        break;
    }
  }

  _handleDataObjectDestroyed(dataObject: DataObject): void {
    if (!this._containerElement) {
      return;
    }

    switch (this._hierarchy) {
      case TreeView.TypesHierarchy:
        this._removeTypesNode(dataObject.id);
        break;
      case TreeView.GroupsHierarchy:
        this._removeGroupsNode(dataObject.id);
        break;
      case TreeView.AggregationHierarchy:
      default:
        this._removeAggregationNode(dataObject.id);
        break;
    }

    if (this._pruneEmptyNodes) {
      this._recomputePruneCounts();
    }
  }

  _validate(): boolean {
    switch (this._hierarchy) {
      case TreeView.GroupsHierarchy:
      case TreeView.TypesHierarchy:
      case TreeView.AggregationHierarchy:
      default:
        return (this._rootNodes.length > 0);
    }
  }

  _validateMetaModelForStoreysHierarchy(level = 0, ctx: any, buildingNode: any): boolean {
    return true;
  }

  _createEnabledNodes(): void {
    if (this._pruneEmptyNodes) {
      this._findEmptyNodes();
    }

    switch (this._hierarchy) {
      case TreeView.GroupsHierarchy:
        this._buildGroupsNodes();
        break;
      case TreeView.TypesHierarchy:
        this._buildTypesNodes();
        break;
      case TreeView.AggregationHierarchy:
      default:
        this._buildAggregationNodes();
        break;
    }

    if (this._sortNodes) {
      this._doSortNodes();
    }

    this._synchNodesToEntities();
    this._createNodeElements();
    this.expandToDepth(this._autoExpandDepth);
  }

  _createDisabledNodes(): void {
    const objects = this.data.objects;
    for (const objectId in objects) {
      const dataObject = objects[objectId];
      if (!this._getAggregationParentDataObject(dataObject)) {
        const dataObjectType = dataObject.type;
        const name = dataObject.name;
        const rootName = (name && name !== "" && name !== "Undefined" && name !== "Default") ? name : `${dataObjectType}`;
        const ul = document.createElement("ul");
        const li = document.createElement("li");
        ul.appendChild(li);
        this._containerElement.appendChild(ul);
        this._rootElement = ul;
        const switchElement = document.createElement("a");
        switchElement.href = "_";
        switchElement.textContent = "!";
        switchElement.classList.add("warn");
        switchElement.classList.add("warning");
        li.appendChild(switchElement);
        const span = document.createElement("span");
        span.textContent = rootName;
        li.appendChild(span);
      }
    }
  }

  _recomputePruneCounts(): void {
    this._dataObjectSceneObjectCounts = {};
    this._findEmptyNodes();
  }

  _findEmptyNodes(): void {
    this._dataObjectSceneObjectCounts = {};
    const objects = this.data.objects;
    for (const objectId in objects) {
      const dataObject = objects[objectId];
      const parent = this._getAggregationParentDataObject(dataObject);
      if (!parent) {
        this._findEmptyNodes2(dataObject);
      }
    }
  }

  _findEmptyNodes2(dataObject: DataObject): number {
    const scene = this._viewer.scene;
    const aggregations = this._getRelatedObjects(dataObject);
    const objectId = dataObject.id;
    const viewObject = scene.objects[objectId];

    let sceneObjectCounts = 0;
    if (viewObject) {
      sceneObjectCounts++;
    }

    if (aggregations.length > 0) {
      for (let i = 0, len = aggregations.length; i < len; i++) {
        const aggregatedDataObject = aggregations[i];
        const aggregatedCount = this._findEmptyNodes2(aggregatedDataObject);
        this._dataObjectSceneObjectCounts[aggregatedDataObject.id] = aggregatedCount;
        sceneObjectCounts += aggregatedCount;
      }
    }

    this._dataObjectSceneObjectCounts[dataObject.id] = sceneObjectCounts;
    return sceneObjectCounts;
  }

  _buildGroupsNodes(): void {
    const objects = this.data.objects;
    for (const objectId in objects) {
      const dataObject = objects[objectId];
      const parent = this._getAggregationParentDataObject(dataObject);
      if (!parent) {
        this._buildGroupsNodes2(dataObject);
      }
    }
  }

  _buildGroupsNodes2(dataObject: DataObject): void {
    if (!this._shouldIncludeDataObject(dataObject)) {
      return;
    }

    this._insertGroupsNode(dataObject, true);

    const aggregations = this._getRelatedObjects(dataObject);
    if (aggregations.length > 0) {
      for (let i = 0, len = aggregations.length; i < len; i++) {
        this._buildGroupsNodes2(aggregations[i]);
      }
    }
  }

  _buildTypesNodes(): void {
    const objects = this.data.objects;
    for (const objectId in objects) {
      this._buildTypesNodes2(objects[objectId]);
    }
  }

  _buildTypesNodes2(dataObject: DataObject): void {
    if (!this._shouldIncludeDataObject(dataObject)) {
      return;
    }

    const type = dataObject.type;
    let typeNode = this._typeRootNodeIndex[type];
    if (!typeNode) {
      typeNode = {
        nodeId: `type:${type}`,
        objectId: `type:${type}`,
        title: type,
        type,
        parentNode: null,
        numViewObjects: 0,
        numVisibleViewObjects: 0,
        checked: false,
        xrayed: false,
        childNodes: []
      };
      this._typeRootNodeIndex[type] = typeNode;
      this._rootNodes.push(typeNode);
      this._objectNodes[typeNode.objectId] = typeNode;
    }

    const node: TreeViewNode = {
      nodeId: dataObject.id,
      objectId: dataObject.id,
      title: this._getDisplayTitle(dataObject, false),
      type: dataObject.type,
      parentNode: typeNode,
      numViewObjects: 0,
      numVisibleViewObjects: 0,
      checked: false,
      xrayed: false,
      childNodes: []
    };

    typeNode.childNodes.push(node);
    this._objectNodes[node.objectId] = node;
  }

  _buildAggregationNodes(): void {
    const objects = this.data.objects;
    for (const objectId in objects) {
      const dataObject = objects[objectId];
      const parent = this._getAggregationParentDataObject(dataObject);
      if (!parent) {
        this._buildAggregationNodes2(dataObject, null);
      }
    }
  }

  _buildAggregationNodes2(dataObject: DataObject, parentNode: TreeViewNode | null): void {
    if (!this._shouldIncludeDataObject(dataObject)) {
      return;
    }

    const node: TreeViewNode = {
      nodeId: dataObject.id,
      objectId: dataObject.id,
      title: this._getDisplayTitle(dataObject, !parentNode),
      type: dataObject.type,
      parentNode,
      numViewObjects: 0,
      numVisibleViewObjects: 0,
      checked: false,
      xrayed: false,
      childNodes: []
    };

    if (parentNode) {
      parentNode.childNodes.push(node);
    } else {
      this._rootNodes.push(node);
    }

    this._objectNodes[node.objectId] = node;

    const aggregations = this._getRelatedObjects(dataObject);
    for (let i = 0, len = aggregations.length; i < len; i++) {
      this._buildAggregationNodes2(aggregations[i], node);
    }
  }

  _insertAggregationNode(dataObject: DataObject): void {
    if (!this._shouldIncludeDataObject(dataObject)) {
      return;
    }
    if (this._objectNodes[dataObject.id]) {
      return;
    }

    const parentDataObject = this._getAggregationParentDataObject(dataObject);
    let parentNode: TreeViewNode | null = null;

    if (parentDataObject) {
      parentNode = this._objectNodes[parentDataObject.id] || null;
      if (!parentNode && this._shouldIncludeDataObject(parentDataObject)) {
        this._insertAggregationNode(parentDataObject);
        parentNode = this._objectNodes[parentDataObject.id] || null;
      }
    }

    const node: TreeViewNode = {
      nodeId: dataObject.id,
      objectId: dataObject.id,
      title: this._getDisplayTitle(dataObject, !parentNode),
      type: dataObject.type,
      parentNode,
      numViewObjects: 0,
      numVisibleViewObjects: 0,
      checked: false,
      xrayed: false,
      childNodes: []
    };

    if (parentNode) {
      parentNode.childNodes.push(node);
      if (this._sortNodes) {
        parentNode.childNodes.sort(this._alphaSortFunc.bind(this));
      }
    } else {
      this._rootNodes.push(node);
      if (this._sortNodes) {
        this._rootNodes.sort(this._alphaSortFunc.bind(this));
      }
    }

    this._objectNodes[node.objectId] = node;
    this._syncSingleNodeToEntity(node);
    this._bubbleNodeCountsToParents(node);
    this._insertNodeIntoDOM(node);

    const aggregations = this._getRelatedObjects(dataObject);
    for (let i = 0, len = aggregations.length; i < len; i++) {
      const child = aggregations[i];
      if (!this._objectNodes[child.id] && this._shouldIncludeDataObject(child)) {
        this._insertAggregationNode(child);
      }
    }
  }

  _removeAggregationNode(objectId: string): void {
    const node = this._objectNodes[objectId];
    if (!node) {
      return;
    }

    const childIds = node.childNodes.map((child) => child.objectId);
    for (let i = 0, len = childIds.length; i < len; i++) {
      this._removeAggregationNode(childIds[i]);
    }

    this._subtractNodeCountsFromParents(node);

    if (node.parentNode) {
      const idx = node.parentNode.childNodes.indexOf(node);
      if (idx !== -1) {
        node.parentNode.childNodes.splice(idx, 1);
      }
    } else {
      const idx = this._rootNodes.indexOf(node);
      if (idx !== -1) {
        this._rootNodes.splice(idx, 1);
      }
    }

    this._removeNodeElement(node);
    delete this._objectNodes[objectId];

    if (node.parentNode) {
      this._removeSwitchElementIfLeaf(node.parentNode);
      if (this._pruneEmptyNodes) {
        this._cleanupEmptyStructuralAncestors(node.parentNode);
      }
    }
  }

  _insertTypesNode(dataObject: DataObject): void {
    if (!this._shouldIncludeDataObject(dataObject)) {
      return;
    }
    if (this._objectNodes[dataObject.id]) {
      return;
    }

    const type = dataObject.type;
    let typeNode = this._typeRootNodeIndex[type];

    if (!typeNode) {
      typeNode = {
        nodeId: `type:${type}`,
        objectId: `type:${type}`,
        title: type,
        type,
        parentNode: null,
        numViewObjects: 0,
        numVisibleViewObjects: 0,
        checked: false,
        xrayed: false,
        childNodes: []
      };

      this._typeRootNodeIndex[type] = typeNode;
      this._rootNodes.push(typeNode);
      if (this._sortNodes) {
        this._rootNodes.sort(this._alphaSortFunc.bind(this));
      }
      this._objectNodes[typeNode.objectId] = typeNode;
      this._insertNodeIntoDOM(typeNode);
    }

    const node: TreeViewNode = {
      nodeId: dataObject.id,
      objectId: dataObject.id,
      title: this._getDisplayTitle(dataObject, false),
      type: dataObject.type,
      parentNode: typeNode,
      numViewObjects: 0,
      numVisibleViewObjects: 0,
      checked: false,
      xrayed: false,
      childNodes: []
    };

    typeNode.childNodes.push(node);
    if (this._sortNodes) {
      typeNode.childNodes.sort(this._alphaSortFunc.bind(this));
    }

    this._objectNodes[node.objectId] = node;
    this._syncSingleNodeToEntity(node);
    this._bubbleNodeCountsToParents(node);
    this._insertNodeIntoDOM(node);
  }

  _removeTypesNode(objectId: string): void {
    const node = this._objectNodes[objectId];
    if (!node) {
      return;
    }

    this._subtractNodeCountsFromParents(node);

    const parentNode = node.parentNode;
    if (parentNode) {
      const idx = parentNode.childNodes.indexOf(node);
      if (idx !== -1) {
        parentNode.childNodes.splice(idx, 1);
      }
    }

    this._removeNodeElement(node);
    delete this._objectNodes[objectId];

    if (parentNode) {
      this._removeSwitchElementIfLeaf(parentNode);

      if (parentNode.childNodes.length === 0) {
        const rootIdx = this._rootNodes.indexOf(parentNode);
        if (rootIdx !== -1) {
          this._rootNodes.splice(rootIdx, 1);
        }
        this._removeNodeElement(parentNode);
        delete this._objectNodes[parentNode.objectId];
        delete this._typeRootNodeIndex[parentNode.type];
      }
    }
  }

  _getGroupPathNodesForObject(dataObject: DataObject): DataObject[] {
    const chain: DataObject[] = [];
    let current: DataObject | null = dataObject;

    while (current) {
      chain.unshift(current);
      current = this._getAggregationParentDataObject(current);
    }

    const result: DataObject[] = [];
    let searchFrom = 0;

    for (let i = 0; i < this._groupTypes.length; i++) {
      const wantedType = this._groupTypes[i];
      let found: DataObject | null = null;

      for (let j = searchFrom; j < chain.length; j++) {
        if (chain[j].type === wantedType) {
          found = chain[j];
          searchFrom = j + 1;
          break;
        }
      }

      if (!found) {
        break;
      }

      result.push(found);
    }

    return result;
  }

  _getGroupNodeKey(pathObjects: DataObject[], index: number): string {
    return `group:${pathObjects.slice(0, index + 1).map((o) => o.id).join("/")}`;
  }

  _getGroupsTypeNodeKey(parentNode: TreeViewNode, type: string): string {
    return `grouptype:${parentNode.objectId}:${type}`;
  }

  _insertGroupsNode(dataObject: DataObject, building = false): void {
    if (!this._shouldIncludeDataObject(dataObject)) {
      return;
    }
    if (this._objectNodes[dataObject.id]) {
      return;
    }

    const pathObjects = this._getGroupPathNodesForObject(dataObject);
    let parentNode: TreeViewNode | null = null;

    for (let i = 0, len = pathObjects.length; i < len; i++) {
      const groupObject = pathObjects[i];
      const key = this._getGroupNodeKey(pathObjects, i);

      let groupNode = this._groupNodeIndex[key];
      if (!groupNode) {
        groupNode = {
          nodeId: key,
          objectId: key,
          title: i === 0
            ? (this._rootName || this._getDisplayTitle(groupObject, true))
            : this._getDisplayTitle(groupObject, false),
          type: groupObject.type,
          parentNode,
          numViewObjects: 0,
          numVisibleViewObjects: 0,
          checked: false,
          xrayed: false,
          childNodes: []
        };

        this._groupNodeIndex[key] = groupNode;
        this._objectNodes[groupNode.objectId] = groupNode;

        if (parentNode) {
          parentNode.childNodes.push(groupNode);
          if (this._sortNodes) {
            parentNode.childNodes.sort(this._alphaSortFunc.bind(this));
          }
        } else {
          this._rootNodes.push(groupNode);
          if (this._sortNodes) {
            this._rootNodes.sort(this._alphaSortFunc.bind(this));
          }
        }

        if (!building) {
          this._insertNodeIntoDOM(groupNode);
        }
      }

      parentNode = groupNode;
    }

    if (!parentNode) {
      const topKey = `groupfallback:${dataObject.type}`;
      let typeRoot = this._groupNodeIndex[topKey];
      if (!typeRoot) {
        typeRoot = {
          nodeId: topKey,
          objectId: topKey,
          title: dataObject.type,
          type: dataObject.type,
          parentNode: null,
          numViewObjects: 0,
          numVisibleViewObjects: 0,
          checked: false,
          xrayed: false,
          childNodes: []
        };
        this._groupNodeIndex[topKey] = typeRoot;
        this._objectNodes[typeRoot.objectId] = typeRoot;
        this._rootNodes.push(typeRoot);
        if (this._sortNodes) {
          this._rootNodes.sort(this._alphaSortFunc.bind(this));
        }

        if (!building) {
          this._insertNodeIntoDOM(typeRoot);
        }
      }
      parentNode = typeRoot;
    }

    const typeKey = this._getGroupsTypeNodeKey(parentNode, dataObject.type);
    let typeNode = this._groupsTypeNodeIndex[typeKey];
    if (!typeNode) {
      typeNode = {
        nodeId: typeKey,
        objectId: typeKey,
        title: dataObject.type,
        type: dataObject.type,
        parentNode,
        numViewObjects: 0,
        numVisibleViewObjects: 0,
        checked: false,
        xrayed: false,
        childNodes: []
      };

      this._groupsTypeNodeIndex[typeKey] = typeNode;
      this._objectNodes[typeNode.objectId] = typeNode;
      parentNode.childNodes.push(typeNode);
      if (this._sortNodes) {
        parentNode.childNodes.sort(this._alphaSortFunc.bind(this));
      }

      if (!building) {
        this._insertNodeIntoDOM(typeNode);
      }
    }

    const leafNode: TreeViewNode = {
      nodeId: dataObject.id,
      objectId: dataObject.id,
      title: this._getDisplayTitle(dataObject, false),
      type: dataObject.type,
      parentNode: typeNode,
      numViewObjects: 0,
      numVisibleViewObjects: 0,
      checked: false,
      xrayed: false,
      childNodes: []
    };

    typeNode.childNodes.push(leafNode);
    if (this._sortNodes) {
      typeNode.childNodes.sort(this._alphaSortFunc.bind(this));
    }

    this._objectNodes[leafNode.objectId] = leafNode;

    this._syncSingleNodeToEntity(leafNode);
    this._bubbleNodeCountsToParents(leafNode);

    if (!building) {
      this._insertNodeIntoDOM(leafNode);
    }
  }

  _removeGroupsNode(objectId: string): void {
    const node = this._objectNodes[objectId];
    if (!node) {
      return;
    }

    this._subtractNodeCountsFromParents(node);

    const parentNode = node.parentNode;
    if (parentNode) {
      const idx = parentNode.childNodes.indexOf(node);
      if (idx !== -1) {
        parentNode.childNodes.splice(idx, 1);
      }
    }

    this._removeNodeElement(node);
    delete this._objectNodes[objectId];

    if (parentNode) {
      this._removeSwitchElementIfLeaf(parentNode);
      this._cleanupEmptyStructuralAncestors(parentNode);
    }
  }

  _doSortNodes(): void {
    this._rootNodes.sort(this._alphaSortFunc.bind(this));
    for (let i = 0, len = this._rootNodes.length; i < len; i++) {
      this._sortChildNodes(this._rootNodes[i]);
    }
  }

  _sortChildNodes(node: TreeViewNode): void {
    const childNodes = node.childNodes;
    if (!childNodes || childNodes.length === 0) {
      return;
    }
    childNodes.sort(this._alphaSortFunc.bind(this));
    for (let i = 0, len = childNodes.length; i < len; i++) {
      this._sortChildNodes(childNodes[i]);
    }
  }

  _getSpatialSortFunc() {
    return this._spatialSortFunc;
  }

  _alphaSortFunc(node1: TreeViewNode, node2: TreeViewNode): number {
    const title1 = node1.title.toUpperCase();
    const title2 = node2.title.toUpperCase();
    if (title1 < title2) {
      return -1;
    }
    if (title1 > title2) {
      return 1;
    }
    return 0;
  }

  _synchNodesToEntities(): void {
    const objectIds = Object.keys(this.data.objects);
    const viewObjects = this.view.objects;

    for (let i = 0, len = objectIds.length; i < len; i++) {
      const objectId = objectIds[i];
      const node = this._objectNodes[objectId];
      if (!node) {
        continue;
      }

      const viewObject = viewObjects[objectId];
      if (!viewObject) {
        continue;
      }

      const visible = viewObject.visible;
      node.numViewObjects = 1;
      node.xrayed = viewObject.xrayed;
      if (visible) {
        node.numVisibleViewObjects = 1;
        node.checked = true;
      } else {
        node.numVisibleViewObjects = 0;
        node.checked = false;
      }

      let parentNode = node.parentNode;
      while (parentNode) {
        parentNode.numViewObjects++;
        if (visible) {
          parentNode.numVisibleViewObjects++;
          parentNode.checked = true;
        }
        parentNode = parentNode.parentNode;
      }
    }
  }

  _withNodeTree(node: TreeViewNode, callback: (node: TreeViewNode) => void): void {
    callback(node);
    const childNodes = node.childNodes;
    if (!childNodes) {
      return;
    }
    for (let i = 0, len = childNodes.length; i < len; i++) {
      this._withNodeTree(childNodes[i], callback);
    }
  }

  _createNodeElements(): void {
    if (this._rootNodes.length === 0) {
      return;
    }
    const rootNodeElements = this._rootNodes.map((rootNode) => this._createNodeElement(rootNode));
    const ul = document.createElement("ul");
    rootNodeElements.forEach((nodeElement) => {
      ul.appendChild(nodeElement);
    });
    this._containerElement.appendChild(ul);
    this._rootElement = ul;
  }

  _createNodeElement(node: TreeViewNode): HTMLElement {
    const nodeElement = document.createElement("li");
    const nodeId = node.nodeId;

    if (node.xrayed) {
      nodeElement.classList.add("xrayed-node");
    }
    nodeElement.id = "node-" + nodeId;

    if (node.childNodes.length > 0) {
      const switchElementId = "switch-" + nodeId;
      const switchElement = document.createElement("a");
      switchElement.href = "_";
      switchElement.id = switchElementId;
      switchElement.textContent = "+";
      switchElement.classList.add("plus");
      switchElement.addEventListener("click", this._switchExpandHandler);
      nodeElement.appendChild(switchElement);
    }

    const checkbox = document.createElement("input");
    checkbox.id = nodeId;
    checkbox.type = "checkbox";
    checkbox.checked = node.checked;
    (checkbox.style as any)["pointer-events"] = "all";
    checkbox.addEventListener("change", this._checkboxChangeHandler);
    nodeElement.appendChild(checkbox);

    const span = document.createElement("span");
    span.textContent = node.title;
    nodeElement.appendChild(span);

    span.oncontextmenu = (e: MouseEvent) => {
      this.events.onContextMenu.dispatch(this, {
        event: e,
        treeView: this,
        treeViewNode: node
      } as TreeViewNodeContextMenuEvent);
      e.preventDefault();
    };

    span.onclick = (e: MouseEvent) => {
      this.events.onNodeTitleClicked.dispatch(this, {
        event: e,
        treeView: this,
        treeViewNode: node
      } as TreeViewNodeTitleClickedEvent);
      e.preventDefault();
    };

    // Per-row action buttons — surfaced on hover. Each fires
    // its own event; the host (e.g. ExplorerPanel) decides what
    // to do with the node (toggle selection, frame the camera,
    // etc.).
    const actions = document.createElement("span");
    actions.className = "xeokit-tree-view-row-actions";
    actions.appendChild(this._buildActionButton(
      "select", "Select / deselect", SELECT_ICON_SVG,
      (e) => {
        this.events.onNodeSelectClicked.dispatch(this, {
          event: e, treeView: this, treeViewNode: node,
        } as TreeViewNodeTitleClickedEvent);
      },
    ));
    actions.appendChild(this._buildActionButton(
      "frame", "Frame in camera", FRAME_ICON_SVG,
      (e) => {
        this.events.onNodeFrameClicked.dispatch(this, {
          event: e, treeView: this, treeViewNode: node,
        } as TreeViewNodeTitleClickedEvent);
      },
    ));
    nodeElement.appendChild(actions);

    return nodeElement;
  }

  _buildActionButton(
    kind:    string,
    title:   string,
    iconSvg: string,
    onClick: (ev: MouseEvent) => void,
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "xeokit-tree-view-action";
    btn.dataset.action = kind;
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.innerHTML = iconSvg;
    btn.addEventListener("click", (ev) => {
      // The label / checkbox / context menu all sit on the
      // same row; without these guards the click would also
      // fire the row's title handler (and toggle the chevron).
      ev.stopPropagation();
      ev.preventDefault();
      onClick(ev);
      // Drop focus so the row drops out of `:focus-within` and
      // the action strip rolls back under the hover gate.
      // Without this the buttons stay visible after every
      // click until the user clicks somewhere else.
      btn.blur();
    });
    btn.addEventListener("mousedown", (ev) => ev.stopPropagation());
    return btn;
  }

  _expandSwitchElement(switchElement: HTMLElement): void {
    const parentElement = switchElement.parentElement;
    if (!parentElement) {
      return;
    }

    const expanded = this._getDirectChildUL(parentElement);
    if (expanded) {
      return;
    }

    const nodeId = parentElement.id.replace("node-", "");
    const switchNode = this._objectNodes[nodeId];
    if (!switchNode) {
      return;
    }

    const childNodes = switchNode.childNodes;
    const nodeElements = childNodes.map((node) => this._createNodeElement(node));
    const ul = document.createElement("ul");
    nodeElements.forEach((nodeElement) => {
      ul.appendChild(nodeElement);
    });

    parentElement.appendChild(ul);
    switchElement.classList.remove("plus");
    switchElement.classList.add("minus");
    switchElement.textContent = "-";
    switchElement.removeEventListener("click", this._switchExpandHandler);
    switchElement.addEventListener("click", this._switchCollapseHandler);
  }

  _collapseNode(objectId: string): void {
    const switchElementId = `switch-${objectId}`;
    const switchElement = document.getElementById(switchElementId);
    if (!switchElement) {
      return;
    }
    this._collapseSwitchElement(switchElement as HTMLElement);
  }

  _collapseSwitchElement(switchElement: HTMLElement): void {
    const parent = switchElement.parentElement;
    if (!parent) {
      return;
    }
    const ul = this._getDirectChildUL(parent);
    if (!ul) {
      return;
    }
    parent.removeChild(ul);
    switchElement.classList.remove("minus");
    switchElement.classList.add("plus");
    switchElement.textContent = "+";
    switchElement.removeEventListener("click", this._switchCollapseHandler);
    switchElement.addEventListener("click", this._switchExpandHandler);
  }

  _isDefaultishName(name: string | undefined | null): boolean {
    return !name || name === "" || name === "Undefined" || name === "Default";
  }

  _getDisplayTitle(dataObject: DataObject, isRoot = false): string {
    const type = dataObject.type;
    const name = dataObject.name;
    if (isRoot) {
      return this._rootName || (this._isDefaultishName(name) ? type : (name as string));
    }
    return this._isDefaultishName(name) ? type : (name as string);
  }

  _getRelatedObjects(dataObject: DataObject): DataObject[] {
    if (!dataObject.related) return [];
    const result: DataObject[] = [];
    for (const lt of this._linkTypes) {
      const rels = dataObject.related[lt];
      if (rels) {
        for (let i = 0, len = rels.length; i < len; i++) {
          result.push(rels[i].relatedObject);
        }
      }
    }
    return result;
  }

  _getAggregationParentDataObject(dataObject: DataObject): DataObject | null {
    if (!dataObject.relating) return null;
    for (const lt of this._linkTypes) {
      const rels = dataObject.relating[lt];
      if (rels && rels.length > 0) {
        return rels[0].relatingObject || null;
      }
    }
    return null;
  }

  _shouldIncludeDataObject(dataObject: DataObject): boolean {
    if (!this._pruneEmptyNodes) {
      return true;
    }
    return !!this._dataObjectSceneObjectCounts[dataObject.id];
  }

  _syncSingleNodeToEntity(node: TreeViewNode): void {
    const viewObject = this.view.objects[node.objectId];
    if (!viewObject) {
      node.numViewObjects = 0;
      node.numVisibleViewObjects = 0;
      node.checked = false;
      node.xrayed = false;
      return;
    }

    node.numViewObjects = 1;
    node.xrayed = viewObject.xrayed;
    node.checked = !!viewObject.visible;
    node.numVisibleViewObjects = viewObject.visible ? 1 : 0;
  }

  _bubbleNodeCountsToParents(node: TreeViewNode): void {
    let parentNode = node.parentNode;
    while (parentNode) {
      parentNode.numViewObjects += node.numViewObjects;
      parentNode.numVisibleViewObjects += node.numVisibleViewObjects;
      parentNode.checked = parentNode.numVisibleViewObjects > 0;

      const checkbox = document.getElementById(parentNode.nodeId) as HTMLInputElement | null;
      if (checkbox) {
        checkbox.checked = parentNode.checked;
      }

      parentNode = parentNode.parentNode;
    }
  }

  _subtractNodeCountsFromParents(node: TreeViewNode): void {
    let parentNode = node.parentNode;
    while (parentNode) {
      parentNode.numViewObjects -= node.numViewObjects;
      parentNode.numVisibleViewObjects -= node.numVisibleViewObjects;
      if (parentNode.numViewObjects < 0) {
        parentNode.numViewObjects = 0;
      }
      if (parentNode.numVisibleViewObjects < 0) {
        parentNode.numVisibleViewObjects = 0;
      }
      parentNode.checked = parentNode.numVisibleViewObjects > 0;

      const checkbox = document.getElementById(parentNode.nodeId) as HTMLInputElement | null;
      if (checkbox) {
        checkbox.checked = parentNode.checked;
      }

      parentNode = parentNode.parentNode;
    }
  }

  _ensureRootElement(): HTMLUListElement {
    if (!this._rootElement) {
      this._rootElement = document.createElement("ul");
      this._containerElement.appendChild(this._rootElement);
    }
    return this._rootElement;
  }

  _getDirectChildUL(parentElement: HTMLElement): HTMLUListElement | null {
    const children = parentElement.children;
    for (let i = 0, len = children.length; i < len; i++) {
      const child = children[i];
      if (child.tagName === "UL") {
        return child as HTMLUListElement;
      }
    }
    return null;
  }

  _ensureExpandedChildrenContainer(parentElement: HTMLElement): HTMLUListElement | null {
    return this._getDirectChildUL(parentElement);
  }

  _ensureSwitchElement(node: TreeViewNode): void {
    const li = document.getElementById(`node-${node.nodeId}`);
    if (!li) {
      return;
    }

    let switchElement = document.getElementById(`switch-${node.nodeId}`) as HTMLAnchorElement | null;
    if (switchElement) {
      return;
    }

    switchElement = document.createElement("a");
    switchElement.href = "_";
    switchElement.id = `switch-${node.nodeId}`;
    switchElement.textContent = "+";
    switchElement.classList.add("plus");
    switchElement.addEventListener("click", this._switchExpandHandler);

    li.insertBefore(switchElement, li.firstChild);
  }

  _removeSwitchElementIfLeaf(node: TreeViewNode): void {
    if (node.childNodes.length > 0) {
      return;
    }
    const switchElement = document.getElementById(`switch-${node.nodeId}`);
    if (!switchElement || !switchElement.parentElement) {
      return;
    }
    switchElement.removeEventListener("click", this._switchExpandHandler);
    switchElement.removeEventListener("click", this._switchCollapseHandler);
    switchElement.parentElement.removeChild(switchElement);
  }

  _insertNodeIntoDOM(node: TreeViewNode): void {
    const nodeElement = this._createNodeElement(node);

    if (!node.parentNode) {
      const rootUL = this._ensureRootElement();
      this._insertElementAtSortedIndex(rootUL, nodeElement, this._rootNodes, node);
      return;
    }

    const parentLI = document.getElementById(`node-${node.parentNode.nodeId}`);
    if (!parentLI) {
      return;
    }

    if (node.parentNode.childNodes.length === 1) {
      this._ensureSwitchElement(node.parentNode);
    }

    const parentUL = this._ensureExpandedChildrenContainer(parentLI);
    if (!parentUL) {
      return;
    }

    this._insertElementAtSortedIndex(parentUL, nodeElement, node.parentNode.childNodes, node);
  }

  _insertElementAtSortedIndex(
    container: HTMLElement,
    nodeElement: HTMLElement,
    siblings: TreeViewNode[],
    node: TreeViewNode
  ): void {
    if (!this._sortNodes) {
      container.appendChild(nodeElement);
      return;
    }

    const idx = siblings.indexOf(node);
    if (idx >= 0 && idx < container.children.length) {
      container.insertBefore(nodeElement, container.children[idx]);
    } else {
      container.appendChild(nodeElement);
    }
  }

  _removeNodeElement(node: TreeViewNode): void {
    const li = document.getElementById(`node-${node.nodeId}`);
    if (li && li.parentNode) {
      li.parentNode.removeChild(li);
    }
    if (this._showListItemElementId === `node-${node.nodeId}`) {
      this._showListItemElementId = null;
    }
  }

  _removeStructuralNodeFromIndexes(node: TreeViewNode): void {
    if (node.objectId.indexOf("group:") === 0 || node.objectId.indexOf("groupfallback:") === 0) {
      delete this._groupNodeIndex[node.objectId];
      return;
    }
    if (node.objectId.indexOf("grouptype:") === 0) {
      delete this._groupsTypeNodeIndex[node.objectId];
      return;
    }
    if (node.objectId.indexOf("type:") === 0) {
      if (this._typeRootNodeIndex[node.type] === node) {
        delete this._typeRootNodeIndex[node.type];
      }
    }
  }

  _cleanupEmptyStructuralAncestors(node: TreeViewNode | null): void {
    let current = node;

    while (current) {
      const isStructural = !!(
        current.objectId.indexOf("group:") === 0 ||
        current.objectId.indexOf("groupfallback:") === 0 ||
        current.objectId.indexOf("grouptype:") === 0 ||
        current.objectId.indexOf("type:") === 0
      );

      const shouldRemove =
        isStructural &&
        current.childNodes.length === 0 &&
        current.numViewObjects === 0 &&
        !this.view.objects[current.objectId];

      if (!shouldRemove) {
        this._removeSwitchElementIfLeaf(current);
        current = current.parentNode;
        continue;
      }

      const parent = current.parentNode;

      if (parent) {
        const idx = parent.childNodes.indexOf(current);
        if (idx !== -1) {
          parent.childNodes.splice(idx, 1);
        }
      } else {
        const idx = this._rootNodes.indexOf(current);
        if (idx !== -1) {
          this._rootNodes.splice(idx, 1);
        }
      }

      this._removeNodeElement(current);
      delete this._objectNodes[current.objectId];
      this._removeStructuralNodeFromIndexes(current);

      current = parent;
    }
  }

  _ensureStyles(): void {
    if (typeof document === "undefined") {
      return;
    }

    const existing = document.getElementById(TREE_VIEW_STYLE_ELEMENT_ID) as HTMLStyleElement | null;
    if (existing) {
      return;
    }

    const styleElement = document.createElement("style");
    styleElement.id = TREE_VIEW_STYLE_ELEMENT_ID;
    styleElement.type = "text/css";
    styleElement.textContent = TREE_VIEW_CSS;
    document.head.appendChild(styleElement);
  }

  _createDefaultContainerElement(): HTMLElement {
    if (typeof document === "undefined") {
      throw new Error("Config expected: containerElement");
    }

    const containerElement = document.createElement("div");
    containerElement.style.position = "absolute";
    containerElement.style.left = "0";
    containerElement.style.top = "0";
    containerElement.style.zIndex = "100000";
    document.body.appendChild(containerElement);

    return containerElement;
  }
}
