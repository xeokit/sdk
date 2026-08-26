import type {TreeViewParams} from "./TreeViewParams";
import {TreeView} from "./TreeView";
import {TreeViewEvents} from "./TreeViewEvents";

const TABBED_TREE_VIEW_STYLE_ELEMENT_ID = "xeokit-tabbed-treeview-styles";

const TABBED_TREE_VIEW_CSS = `
  .xeokit-tree-panel {
    position: absolute;
    left: 16px;
    top: 76px;
    width: 640px;
    max-height: calc(100vh - 32px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.94);
    border: 1px solid rgba(15, 23, 42, 0.08);
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.14);
    backdrop-filter: blur(10px);
    color: #1f2937;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    z-index: 100000;
  }

  .xeokit-tree-panel-header {
    padding: 14px 16px 12px 16px;
    border-bottom: 1px solid rgba(15, 23, 42, 0.06);
    background: linear-gradient(to bottom, rgba(255,255,255,0.75), rgba(255,255,255,0.55));
  }

  .xeokit-tree-panel-title {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.01em;
    color: #111827;
    margin-bottom: 2px;
  }

  .xeokit-tree-panel-subtitle {
    font-size: 12px;
    color: #6b7280;
  }

  .xeokit-tree-panel-tabs {
    display: flex;
    gap: 8px;
    padding: 10px 12px 0 12px;
    border-bottom: 1px solid rgba(15, 23, 42, 0.06);
    background: rgba(255, 255, 255, 0.55);
  }

  .xeokit-tree-panel-tab {
    appearance: none;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: #f8fafc;
    color: #475569;
    border-radius: 10px 10px 0 0;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 120ms ease;
  }

  .xeokit-tree-panel-tab:hover {
    background: #eef2ff;
    color: #2563eb;
    border-color: rgba(37, 99, 235, 0.28);
  }

  .xeokit-tree-panel-tab.active {
    background: #dbeafe;
    color: #1d4ed8;
    border-color: rgba(37, 99, 235, 0.28);
  }

  .xeokit-tree-panel-body {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .xeokit-tree-panel-pane {
    display: none;
    height: 100%;
    overflow: auto;
    padding: 10px 10px 14px 10px;
  }

  .xeokit-tree-panel-pane.active {
    display: block;
  }

  .xeokit-tree-panel-pane::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  .xeokit-tree-panel-pane::-webkit-scrollbar-thumb {
    background: rgba(100, 116, 139, 0.28);
    border-radius: 999px;
    border: 2px solid transparent;
    background-clip: content-box;
  }

  .xeokit-tree-panel-pane .xeokit-tree-view {
    position: relative;
  }
`;

export interface TabbedTreeViewPanelParams extends TreeViewParams {
  title?: string;
  subtitle?: string;
  panelElement?: HTMLElement;
}

/**
 * A tabbed panel that hosts three TreeView instances, one for each hierarchy mode.
 *
 * This keeps TreeView itself focused on rendering a single hierarchy, while giving
 * us a higher-level UI component that presents Aggregation, Types, and Groups side-by-side
 * behind tabs.
 */
export class TabbedTreeViewPanel {
  public readonly aggregationTreeView: TreeView;
  public readonly typesTreeView: TreeView;
  public readonly groupsTreeView: TreeView;

  public readonly panelElement: HTMLElement;

  /**
   * The events emitted by this TabbedTreeViewPanel.
   */
  public readonly events: TreeViewEvents = new TreeViewEvents();

  private readonly _ownsPanelElement: boolean;
  private readonly _tabButtons: HTMLButtonElement[] = [];
  private readonly _tabPanes: HTMLDivElement[] = [];

  constructor(params: TabbedTreeViewPanelParams) {
    if (!params.data) {
      throw new Error("Config expected: data");
    }

    if (!params.view) {
      throw new Error("Config expected: view");
    }

    this._ensureStyles();

    this.panelElement = params.panelElement || this._createDefaultPanelElement();
    this._ownsPanelElement = !params.panelElement;
    this.panelElement.classList.add("xeokit-tree-panel");

    const header = document.createElement("div");
    header.className = "xeokit-tree-panel-header";

    const title = document.createElement("div");
    title.className = "xeokit-tree-panel-title";
    title.textContent = params.title || "Model Tree";

    const subtitle = document.createElement("div");
    subtitle.className = "xeokit-tree-panel-subtitle";
    subtitle.textContent = params.subtitle || "Browse the model using different hierarchy views";

    header.appendChild(title);
    header.appendChild(subtitle);

    const tabs = document.createElement("div");
    tabs.className = "xeokit-tree-panel-tabs";

    const body = document.createElement("div");
    body.className = "xeokit-tree-panel-body";

    this.panelElement.appendChild(header);
    this.panelElement.appendChild(tabs);
    this.panelElement.appendChild(body);

    const aggregationPane = this._createPane(body);
    const typesPane = this._createPane(body);
    const groupsPane = this._createPane(body);

    const baseParams: TreeViewParams = {
      ...params
    };

    this.aggregationTreeView = new TreeView({
      ...baseParams,
      containerElement: aggregationPane,
      hierarchy: TreeView.AggregationHierarchy,
      events: this.events
    });

    this.typesTreeView = new TreeView({
      ...baseParams,
      containerElement: typesPane,
      hierarchy: TreeView.TypesHierarchy,
      events: this.events
    });

    this.groupsTreeView = new TreeView({
      ...baseParams,
      containerElement: groupsPane,
      hierarchy: TreeView.GroupsHierarchy,
      events: this.events
    });

    this._createTabButton(tabs, "Aggregation", 0);
    this._createTabButton(tabs, "Types", 1);
    this._createTabButton(tabs, "Storeys", 2);

    this._activateTab(0);
  }

  /**
   * Activates a tab by index.
   */
  setActiveTab(tabIndex: number): void {
    this._activateTab(tabIndex);
  }

  /**
   * Highlights a node in all three tree views.
   */
  showNode(objectId: string): void {
    this.aggregationTreeView.showNode(objectId);
    this.typesTreeView.showNode(objectId);
    this.groupsTreeView.showNode(objectId);
  }

  /**
   * Removes any current highlight from all tree views.
   */
  unShowNode(): void {
    this.aggregationTreeView.unShowNode();
    this.typesTreeView.unShowNode();
    this.groupsTreeView.unShowNode();
  }

  /**
   * Destroys the panel and its child tree views.
   */
  destroy(): void {
    this.aggregationTreeView.destroy();
    this.typesTreeView.destroy();
    this.groupsTreeView.destroy();

    if (this._ownsPanelElement && this.panelElement.parentNode) {
      this.panelElement.parentNode.removeChild(this.panelElement);
    }
  }

  private _createPane(body: HTMLElement): HTMLDivElement {
    const pane = document.createElement("div");
    pane.className = "xeokit-tree-panel-pane";
    body.appendChild(pane);
    this._tabPanes.push(pane);
    return pane;
  }

  private _createTabButton(tabs: HTMLElement, label: string, tabIndex: number): void {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "xeokit-tree-panel-tab";
    button.textContent = label;
    button.addEventListener("click", () => {
      this._activateTab(tabIndex);
    });
    tabs.appendChild(button);
    this._tabButtons.push(button);
  }

  private _activateTab(tabIndex: number): void {
    for (let i = 0; i < this._tabButtons.length; i++) {
      const active = i === tabIndex;
      this._tabButtons[i].classList.toggle("active", active);
      this._tabPanes[i].classList.toggle("active", active);
    }
  }

  private _ensureStyles(): void {
    if (typeof document === "undefined") {
      return;
    }

    const existing = document.getElementById(TABBED_TREE_VIEW_STYLE_ELEMENT_ID);
    if (existing) {
      return;
    }

    const styleElement = document.createElement("style");
    styleElement.id = TABBED_TREE_VIEW_STYLE_ELEMENT_ID;
    styleElement.type = "text/css";
    styleElement.textContent = TABBED_TREE_VIEW_CSS;
    document.head.appendChild(styleElement);
  }

  private _createDefaultPanelElement(): HTMLElement {
    if (typeof document === "undefined") {
      throw new Error("Config expected: panelElement");
    }

    const panelElement = document.createElement("div");
    document.body.appendChild(panelElement);
    return panelElement;
  }
}
