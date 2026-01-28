import {EventEmitter, SDKInternalException} from "../core";
import type {Data, DataModel, DataObject} from "../data";
import type {View, Viewer, ViewObject} from "../viewer";
import type {TreeViewNode} from "./TreeViewNode";
import type {TreeViewNodeContextMenuEvent} from "./TreeViewNodeContextMenuEvent";
import type {TreeViewNodeTitleClickedEvent} from "./TreeViewNodeTitleClickedEvent";
import type {TreeViewParams} from "./TreeViewParams";
import {TreeViewEvents} from "./TreeViewEvents";


/**
 * An HTMl tree view that navigates the {@link data!DataObject | DataObjects} in the given
 * {@link data!Data | Data}, while controlling the visibility of their corresponding
 * {@link viewer!ViewObject | ViewObjects} in the given {@link viewer!View | View}.
 *
 * See {@link treeview | @xeokit/sdk/treeview} for usage.
 */
export class TreeView  {

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
   * as ````TreeViewParams.groupTypes[2]````, and so on. Once descended beyond the length of ````TreeViewParams.groupTypes````,
   * the TreeViewNodes are just grouped by type.
   */
  static GroupsHierarchy = 2;

  /**
   * The events emitted by this TreeView.
   */
  public readonly events: TreeViewEvents = new TreeViewEvents();

  /**
   * The semantic {@link data!Data | Data} model that determines the structure of this TreeView.
   */
  public readonly data: Data;

  /**
   * The {@link viewer!View | View} that contains the {@link viewer!ViewObject | ViewObjects}
   * navigated by this TreeView.
   */
  public readonly view: View;


  _linkType: string;
  _groupTypes: string[];
  _containerElement: HTMLElement;
  _hierarchy: number;
  _dataModels: {
    [key: string]: DataModel
  };
  _autoAddModels: boolean;
  _autoExpandDepth: any;
  _sortNodes: boolean | undefined;
  _pruneEmptyNodes: boolean;
  _viewer: Viewer;
  _rootElement: HTMLUListElement | null;
  _muteSceneEvents: boolean;
  _muteTreeEvents: boolean;
  _rootNodes: any[];
  _objectNodes: {
    [key: string]: TreeViewNode
  };
  _rootName: any;
  _showListItemElementId: string | null;
  _spatialSortFunc: (node1: TreeViewNode, node2: TreeViewNode) => (number);
  _switchExpandHandler: (event: MouseEvent) => void;
  _switchCollapseHandler: (event: MouseEvent) => void;
  _checkboxChangeHandler: (event: MouseEvent) => void;
  _destroyed: boolean;

  private _onSceneModelCreated: () => void;
  private _onSceneModelDestroyed: () => void;
  private _onViewObjectVisibility: () => void;
  private _onViewObjectXRayed: () => void;
  private _dataObjectSceneObjectCounts: { [key: string]: number };


  /**
   *
   * @param params
   */
  constructor(params: TreeViewParams) {

    if (!params.containerElement) {
      throw new Error("Config expected: containerElement");
    }

    if (!params.data) {
      throw new Error("Config expected: data");
    }

    if (!params.view) {
      throw new Error("Config expected: view");
    }

    this.data = params.data;
    this.view = params.view;

    this._viewer = params.view.viewer;
    this._linkType = params.linkType;
    this._groupTypes = params.groupTypes;
    this._hierarchy = TreeView.AggregationHierarchy;
    this._containerElement = params.containerElement;
    this._dataModels = {};
    this._autoExpandDepth = (params.autoExpandDepth || 0);
    this._sortNodes = (params.sortNodes !== false);
    this._pruneEmptyNodes = (params.pruneEmptyNodes !== false);
    this._rootElement = null;
    this._muteSceneEvents = false;
    this._muteTreeEvents = false;
    this._rootNodes = [];
    this._objectNodes = {}; // Object ID -> TreeViewNode
    this._rootName = params.rootName;
    this._sortNodes = params.sortNodes;
    // @ts-ignore
    this._pruneEmptyNodes = params.pruneEmptyNodes;
    // @ts-ignore
    this._showListItemElementId = null;
    this._destroyed = false;

    this._containerElement.oncontextmenu = (e) => {
      e.preventDefault();
    };

    this._onViewObjectVisibility = this.view.viewer.events.onViewObjectVisibleChanged.subscribe((view: View, viewObject: ViewObject) => {
      if (this._muteSceneEvents) {
        return;
      }
      const objectId = viewObject.id;
      // @ts-ignore
      const node = this._objectNodes[objectId];
      if (!node) {
        return; // Not in this tree
      }
      const visible = viewObject.visible;
      const updated = (visible !== node.checked);
      if (!updated) {
        return;
      }
      this._muteTreeEvents = true;
      node.checked = visible;
      if (visible) {
        node.numVisibleViewObjects++;
      } else {
        node.numVisibleViewObjects--;
      }
      const checkbox = <HTMLFormElement>document.getElementById(node.nodeId);
      if (checkbox) {
        checkbox.checked = visible;
      }
      let parentNode = node.parentNode;
      while (parentNode) {
        parentNode.checked = visible;
        if (visible) {
          parentNode.numVisibleViewObjects++;
        } else {
          parentNode.numVisibleViewObjects--;
        }
        const parentCheckbox = <HTMLFormElement>document.getElementById(parentNode.nodeId);
        if (parentCheckbox) {
          const newChecked = (parentNode.numVisibleViewObjects > 0);
          if (newChecked !== parentCheckbox.checked) {
            parentCheckbox.checked = newChecked;
          }
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
        return; // Not in this tree
      }
      this._muteTreeEvents = true;
      const xrayed = viewObject.xrayed;
      const updated = (xrayed !== node.xrayed);
      if (!updated) {
        return;
      }
      node.xrayed = xrayed;
      const listItemElementId = 'node-' + node.nodeId;
      const listItemElement = document.getElementById(listItemElementId);
      if (listItemElement !== null) {
        if (xrayed) {
          listItemElement.classList.add('xrayed-node');
        } else {
          listItemElement.classList.remove('xrayed-node');
        }
      }
      this._muteTreeEvents = false;
    });

    this._switchExpandHandler = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const switchElement = (<HTMLElement>event.target);
      this._expandSwitchElement(switchElement);
    };

    this._switchCollapseHandler = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const switchElement = (<HTMLElement>event.target);
      this._collapseSwitchElement(switchElement);
    };

    this._checkboxChangeHandler = (event: any) => {
      if (this._muteTreeEvents) {
        return;
      }
      this._muteSceneEvents = true;
      const checkbox = event.target;
      const visible = checkbox.checked;
      const nodeId = checkbox.id;
      const checkedObjectId = nodeId;
      const checkedNode = this._objectNodes[checkedObjectId];
      const objects = this.view.objects;
      let numUpdated = 0;
      this._withNodeTree(checkedNode, (node: TreeViewNode) => {
        const objectId = node.objectId;
        const checkBoxId = node.nodeId;
        const viewObject = objects[objectId];
        const isLeaf = (node.childNodes.length === 0);
        node.numVisibleViewObjects = visible ? node.numViewObjects : 0;
        if (isLeaf && (visible !== node.checked)) {
          numUpdated++;
        }
        node.checked = visible;
        const checkbox2 = <HTMLFormElement>document.getElementById(checkBoxId);
        if (checkbox2) {
          checkbox2.checked = visible;
        }
        if (viewObject) {
          viewObject.visible = visible;
        }
      });
      let parentNode = checkedNode.parentNode;
      while (parentNode) {
        parentNode.checked = visible;
        const checkbox2 = <HTMLFormElement>document.getElementById(parentNode.nodeId); // Parent checkboxes are always in DOM
        if (visible) {
          parentNode.numVisibleViewObjects += numUpdated;
        } else {
          parentNode.numVisibleViewObjects -= numUpdated;
        }
        const newChecked = (parentNode.numVisibleViewObjects > 0);
        if (newChecked !== checkbox2.checked) {
          checkbox2.checked = newChecked;
        }
        parentNode = parentNode.parentNode;
      }
      this._muteSceneEvents = false;
    };

    this.hierarchy = params.hierarchy;

    const modelIds = Object.keys(this.data.models);
    for (let i = 0, len = modelIds.length; i < len; i++) {
      const modelId = modelIds[i];
      this._addModel(modelId);
    }

    this._onSceneModelCreated = this._viewer.scene.events.onSceneModelCreated.subscribe((scene, sceneModel) => {
      if (this.data.models[sceneModel.id]) {
        this._addModel(sceneModel.id);
      }
    });

    this._onSceneModelDestroyed = this._viewer.scene.events.onSceneModelDestroyed.subscribe((scene, sceneModel) => {
      if (this.data.models[sceneModel.id]) {
        this._removeModel(sceneModel.id);
      }
    });
  }

  /**
   * Gets how the nodes are organized within this tree view.
   *
   * Accepted values are:
   *
   * * {@link TreeView.AggregationHierarchy} (default)
   * * {@link TreeView.TypesHierarchy}
   * * {@link TreeView.GroupsHierarchy}
   */
  get hierarchy(): number {
    return this._hierarchy;
  }

  /**
   * Sets how the nodes are organized within this tree view.
   *
   * Accepted values are:
   *
   * * {@link TreeView.AggregationHierarchy} (default)
   * * {@link TreeView.TypesHierarchy}
   * * {@link TreeView.GroupsHierarchy}
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
  get linkType(): string {
    return this._linkType;
  }

  /**
   * When traversing the {@link data!Data | Data} to build the tree UI nodes, at each
   * {@link data!DataObject | DataObjects}, the TreeView will traverse only the outgoing
   * {@link data!Relationship | Relationships} of this type in
   * {@link data!DataObject.relating | DataObject.relating}.
   */
  set linkType(linkType: string) {
    if (this._linkType === linkType) {
      return;
    }
    this._linkType = linkType;
    this._rebuildNodes();
  }

  /**
   * When traversing the {@link data!Data | Data} to build the tree UI nodes for
   * a {@link TreeView.GroupsHierarchy}, these are the values
   * of {@link data!DataObject.type | DataObject.type} that the
   * TreeView groups and subgroups the {@link data!DataObject | DataObjects} on.
   *
   * The grouping for {@link TreeView.GroupsHierarchy} has two levels. The major grouping type is given
   * in ````groupTypes[0]```` and the minor grouping type is given in ````storeyGroups[1]````.
   *
   * Example: ````[IfcBuilding, IfcBuildingStorey]````.
   */
  get groupTypes(): string [] {
    return this._groupTypes;
  }

  /**
   * When traversing the {@link data!Data | Data} to build the tree UI nodes for
   * a {@link TreeView.GroupsHierarchy}, these are the values
   * of {@link data!DataObject.type | DataObject.type} that the
   * TreeView groups and subgroups the {@link data!DataObject | DataObjects} on.
   *
   * The grouping for the {@link treeview!TreeView.GroupsHierarchy | GroupsHierarchy} hierarchy has two levels. The major grouping type is given
   * in ````groupTypes[0]```` and the minor grouping type is given in ````storeyGroups[1]````.
   *
   * Example: ````[IfcBuilding, IfcBuildingStorey]````.
   */
  set groupTypes(groupTypes: string[]) {
    if (this._groupTypes === groupTypes) {
      return;
    }
    this._groupTypes = groupTypes;
    if (this._hierarchy === TreeView.GroupsHierarchy) {
      this._rebuildNodes();
    }
  }

  /**
   * Highlights the tree view node that represents the given object {@link view!ViewObject | ViewObject}.
   *
   * This causes the tree view to collapse, then expand to reveal the node, then highlight the node.
   *
   * If a node is previously highlighted, de-highlights that node and collapses the tree first.
   *
   * Note that if the TreeView was configured with ````pruneEmptyNodes: true```` (default configuration), then the
   * node won't exist in the tree if it has no viewObjects in the {@link scene!Scene | Scene}. in that case, nothing will happen.
   *
   * Within the DOM, the node is represented by an ````<li>```` element. This method will add a ````.highlighted-node```` class to
   * the element to make it appear highlighted, removing that class when de-highlighting it again. See the CSS rules
   * in the TreeView ifcviewer for an example of that class.
   *
   * @param {String} objectId ID of the {@link viewer!ViewObject | ViewObject}.
   */
  showNode(objectId: string): void {
    if (this._showListItemElementId) {
      this.unShowNode();
    }
    const node = this._objectNodes[objectId];
    if (!node) {
      return; // TreeViewNode may not exist for the given object if (this._pruneEmptyNodes == true)
    }
    const nodeId = node.nodeId;
    const switchElementId = "switch-" + nodeId;
    const switchElement = document.getElementById(switchElementId);
    if (switchElement) {
      this._expandSwitchElement(switchElement);
      switchElement.scrollIntoView();
      return;
    }
    const path = [];
    path.unshift(node);
    let parentNode = node.parentNode;
    while (parentNode) {
      path.unshift(parentNode);
      parentNode = parentNode.parentNode;
    }
    for (let i = 0, len = path.length; i < len; i++) {
      const node = path[i];
      const nodeId = node.nodeId;
      const switchElementId = "switch-" + nodeId;
      const switchElement = document.getElementById(switchElementId);
      if (switchElement) {
        this._expandSwitchElement(switchElement);
      }
    }
    const listItemElementId = 'node-' + nodeId;
    const listItemElement = document.getElementById(listItemElementId);
    // @ts-ignore
    listItemElement.scrollIntoView({block: "center"});
    // @ts-ignore
    listItemElement.classList.add("highlighted-node");
    this._showListItemElementId = listItemElementId;
  }

  /**
   * De-highlights the node previously shown with {@link TreeView_showNode}.
   *
   * Does nothing if no node is currently shown.
   *
   * If the node is currently scrolled into view, keeps the node in view.
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
   *
   * Collapses the tree first.
   *
   * @param depth Depth to expand to.
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
        this._expandSwitchElement(switchElement);
        const childNodes = node.childNodes;
        for (let i = 0, len = childNodes.length; i < len; i++) {
          const childNode = childNodes[i];
          expand(childNode, countDepth + 1);
        }
      }
    };
    for (let i = 0, len = this._rootNodes.length; i < len; i++) {
      const rootNode = this._rootNodes[i];
      expand(rootNode, 0);
    }
  }

  /**
   * Closes all the nodes in the tree.
   */
  collapse(): void {
    for (let i = 0, len = this._rootNodes.length; i < len; i++) {
      const rootNode = this._rootNodes[i];
      const objectId = rootNode.objectId;
      this._collapseNode(objectId);
    }
  }

  /**
   * Destroys this TreeView.
   */
  destroy(): void {
    if (!this._containerElement) {
      return;
    }
    this._dataModels = {};
    if (this._rootElement && !this._destroyed) {
      // @ts-ignore
      this._rootElement.parentNode.removeChild(this._rootElement);

      const sceneEvents = this.view.viewer.scene.events;
      sceneEvents.onSceneModelCreated.unsubscribe(this._onSceneModelCreated);

      const viewerEvents = this.view.viewer.events;
      viewerEvents.onViewObjectVisibleChanged.unsubscribe(this._onViewObjectVisibility);
      viewerEvents.onViewObjectXRayedChanged.unsubscribe(this._onViewObjectXRayed);

      this._destroyed = true;
    }
this.events.destroy();
  }

  /**
   * Adds a model to this tree view.
   *
   * @private
   * @param {String} modelId ID of a model {@link viewObject} in {@link scene!Scene_models}.
   * @param {Object} [options] Options for model in the tree view.
   * @param {String} [options.rootName] Optional display name for the root node. Ordinary, for "containment"
   * and {@link treeview!TreeView.GroupsHierarchy | GroupsHierarchy} hierarchy types, the tree would derive the root node name from the model's "IfcProject" element
   * name. This option allows to override that name when it is not suitable as a display name.
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
   *
   * @private
   * @param {String} modelId ID of a model {@link viewObject} in {@link scene!Scene_models}.
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
    if (this._rootElement) {
      // @ts-ignore
      this._rootElement.parentNode.removeChild(this._rootElement);
      this._rootElement = null;
    }

    this._rootNodes = [];
    this._objectNodes = {};
    //    if (this._validate()) {
    this._createEnabledNodes();
    // } else {
    //     this._createDisabledNodes();
    // }
  }

  _validate(): boolean {
    let valid = true;
    switch (this._hierarchy) {
      case TreeView.GroupsHierarchy:
        valid = (this._rootNodes.length > 0);
        //   valid = this._validateMetaModelForStoreysHierarchy();
        break;
      case TreeView.TypesHierarchy:
        valid = (this._rootNodes.length > 0);
        break;
      case TreeView.AggregationHierarchy:
      default:
        valid = (this._rootNodes.length > 0);
        break;
    }
    return valid;
  }

  _validateMetaModelForStoreysHierarchy(level = 0, ctx: any, buildingNode: any) {
    // ctx = ctx || {
    //     foundIFCBuildingStoreys: false
    // };
    // const dataObjectType = dataObject.type;
    // const children = dataObject.children;
    // if (dataObjectType === "IfcBuilding") {
    //     buildingNode = true;
    // } else if (dataObjectType === "IfcBuildingStorey") {
    //     if (!buildingNode) {
    //         errors.push("Can't build storeys hierarchy: IfcBuildingStorey found without parent IfcBuilding");
    //         return false;
    //     }
    //     ctx.foundIFCBuildingStoreys = true;
    // }
    // if (children) {
    //     for (let i = 0, len = children.length; i < len; i++) {
    //         const aggregatedDataObject = children[i];
    //         if (!this._validateMetaModelForStoreysHierarchy(aggregatedDataObject, errors, level + 1, ctx, buildingNode)) {
    //             return false;
    //         }
    //     }
    // }
    // if (level === 0) {
    //     if (!ctx.foundIFCBuildingStoreys) {
    //         // errors.push("Can't build storeys hierarchy: no IfcBuildingStoreys found");
    //     }
    // }
    return true;
  }

  _createEnabledNodes(): void {
    if (this._pruneEmptyNodes) {
      this._findEmptyNodes();
    }
    switch (this._hierarchy) {
      case TreeView.GroupsHierarchy:
        this._buildGroupsNodes();
        if (this._rootNodes.length === 0) {
          throw new SDKInternalException("Cannot build hierarchy TreeView.GroupsHierarchy");
        }
        break;
      case TreeView.TypesHierarchy:
        this._buildTypesNodes();
        break;
      case TreeView.AggregationHierarchy:
      default:
        this._buildAggregationNodes();
    }
    if (this._sortNodes) {
      this._doSortNodes();
    }
    this._synchNodesToEntities();
    this._createNodeElements();
    this.expandToDepth(this._autoExpandDepth);
  }

  _createDisabledNodes(): void { // Creates empty HTML nodes for data graph roots
    const objects = this.data.objects;
    for (const objectId in objects) {
      const dataObject = objects[objectId];
      if (Object.keys(dataObject.relating).length === 0) {
        const dataObjectType = dataObject.type;
        const name = dataObject.name;
        const rootName = (name && name !== "" && name !== "Undefined" && name !== "Default") ? name : `${dataObjectType}`; // TODO: type is a string - needs to be human-readable
        const ul = document.createElement('ul');
        const li = document.createElement('li');
        ul.appendChild(li);
        this._containerElement.appendChild(ul);
        this._rootElement = ul;
        const switchElement = document.createElement('a');
        switchElement.href = '_';
        switchElement.textContent = '!';
        switchElement.classList.add('warn');
        switchElement.classList.add('warning');
        li.appendChild(switchElement);
        const span = document.createElement('span');
        span.textContent = rootName;
        li.appendChild(span);
      }
    }
  }

  _findEmptyNodes(): void {
    const objects = this.data.objects;
    for (const objectId in objects) {
      const dataObject = objects[objectId];
      if (Object.keys(dataObject.relating).length === 0) {
        this._findEmptyNodes2(dataObject);
      }
    }
  }

  _findEmptyNodes2(dataObject: DataObject): number {
    const viewer = this._viewer;
    const scene = viewer.scene;
    const aggregations = dataObject.related[this._linkType];
    const objectId = dataObject.id;
    const viewObject = scene.objects[objectId];
    let sceneObjectCounts = 0;
    if (viewObject) {
      sceneObjectCounts++;
    }
    if (aggregations) {
      for (let i = 0, len = aggregations.length; i < len; i++) {
        const aggregation = aggregations[i];
        const aggregatedDataObject = aggregation.relatedObject;
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
      if (Object.keys(dataObject.relating).length === 0) {
        this._buildGroupsNodes2(dataObject, [], null, null, null);
      }
    }
  }

  _buildGroupsNodes2(
    dataObject: DataObject,
    pathNodes: TreeViewNode[],
    buildingNode: TreeViewNode | null,
    storeyNode: TreeViewNode | null,
    typeNodes: { [key: string]: TreeViewNode } | null) {

    if (this._pruneEmptyNodes && (!this._dataObjectSceneObjectCounts[dataObject.id])) {
      return;
    }

    const objectId = dataObject.id;
    const type = dataObject.type;
    const name = dataObject.name;
    const aggregations = dataObject.related[this._linkType];

    if (pathNodes.length < this._groupTypes.length) {
      const groupType = this._groupTypes[pathNodes.length];
      if (pathNodes.length === 0) {
        if (type === groupType) {
          const node: TreeViewNode = {
            nodeId: objectId,
            objectId,
            title: this._rootName || ((name && name !== "" && name !== "Undefined" && name !== "Default") ? name : type),
            type,
            parentNode: null,
            numViewObjects: 0,
            numVisibleViewObjects: 0,
            checked: false,
            xrayed: false,
            childNodes: []
          };
          pathNodes.push(node);
          this._rootNodes.push(node);
          this._objectNodes[node.objectId] = node;
        }
      } else {
        if (type === groupType) {
          const parentNode = pathNodes[pathNodes.length - 1];
          const node: TreeViewNode = {
            nodeId: objectId,
            objectId,
            title: (name && name !== "" && name !== "Undefined" && name !== "Default") ? name : `${type}`,
            type,
            parentNode,
            numViewObjects: 0,
            numVisibleViewObjects: 0,
            checked: false,
            xrayed: false,
            childNodes: []
          };
          parentNode.childNodes.push(node);
          pathNodes.push(node);
          this._objectNodes[node.objectId] = node;
        }
      }
    } else {

      const parentNode = pathNodes[pathNodes.length - 1];
      const viewObjects = this.view.objects;
      const viewObject = viewObjects[objectId];

      // TODO: makes assumptions about leaves having ViewObjects; can be more flexible
      // TODO: Only makes nodes for objects that have geometric representations, ie. ViewObjects

      if (viewObject) { // Grouped leaf nodes, only for nodes that have ViewObjects
        typeNodes = typeNodes || {};
        let typeNode: TreeViewNode = typeNodes[type];
        if (!typeNode) {
          const typeNodeObjectId = parentNode.objectId + "." + type;
          const typeNodeNodeId = typeNodeObjectId;
          typeNode = {
            nodeId: typeNodeNodeId,
            objectId: typeNodeObjectId,
            title: `${type}`,
            type,
            parentNode,
            numViewObjects: 0,
            numVisibleViewObjects: 0,
            checked: false,
            xrayed: false,
            childNodes: []
          };
          parentNode.childNodes.push(typeNode);
          this._objectNodes[typeNodeObjectId] = typeNode;
          typeNodes[type] = typeNode;
        }
        const leafNode: TreeViewNode = {
          nodeId: objectId,
          objectId,
          title: (name && name !== "" && name !== "Undefined" && name !== "Default") ? name : "" + type,
          type,
          parentNode: typeNode,
          numViewObjects: 0,
          numVisibleViewObjects: 0,
          checked: false,
          xrayed: false,
          childNodes: []
        };
        typeNode.childNodes.push(leafNode);
        this._objectNodes[leafNode.objectId] = leafNode;
      }
    }

    if (aggregations) {
      for (let i = 0, len = aggregations.length; i < len; i++) {
        const aggregation = aggregations[i];
        const aggregatedDataObject = aggregation.relatedObject;
        this._buildGroupsNodes2(aggregatedDataObject, pathNodes, buildingNode, storeyNode, typeNodes);
      }
    }
  }

  _buildTypesNodes() {
    const objects = this.data.objects;
    for (const objectId in objects) {
      const dataObject = objects[objectId];
      if (Object.keys(dataObject.relating).length === 0) {
        this._buildTypesNodes2(dataObject, null, null);
      }
    }
  }

  _buildTypesNodes2(dataObject: DataObject, rootNode: TreeViewNode | null, typeNodes: { [key: string | string]: TreeViewNode } | null) {

    if (this._pruneEmptyNodes && (!this._dataObjectSceneObjectCounts[dataObject.id])) {
      return;
    }

    const objectId = dataObject.id;
    const type = dataObject.type;
    const name = dataObject.name;
    const aggregations = dataObject.related[this._linkType];

    // if (dataObject.id === this._rootdataObject.id) {
    //     rootNode = {
    //         nodeId: objectId,
    //         objectId: objectId,
    //         title: this._rootName || ((name && name !== "" && name !== "Undefined" && name !== "Default")
    //             ? name
    //             : type),
    //         type: type,
    //         parentNode: null,
    //         numViewObjects: 0,
    //         numVisibleViewObjects: 0,
    //         checked: false,
    //         xrayed: false,
    //         childNodes: []
    //     };
    //     this._rootNodes.push(rootNode);
    //     this._objectNodes[rootNode.objectId] = rootNode;
    //     typeNodes = {};
    // } else {
    //     if (rootNode) {
    //         const objects = this._viewer.scene.objects;
    //         const object = objects[objectId];
    //         if (object) {
    //             let typeNode = typeNodes[type];
    //             if (!typeNode) {
    //                 typeNode = {
    //                     nodeId: rootNode.objectId + "." + type,
    //                     objectId: rootNode.objectId + "." + type,
    //                     title: `${type}`,
    //                     type: type,
    //                     parentNode: rootNode,
    //                     numViewObjects: 0,
    //                     numVisibleViewObjects: 0,
    //                     checked: false,
    //                     xrayed: false,
    //                     childNodes: []
    //                 };
    //                 rootNode.childNodes.push(typeNode);
    //                 this._objectNodes[typeNode.objectId] = typeNode;
    //                 typeNodes[type] = typeNode;
    //             }
    //             const node: TreeViewNode = {
    //                 nodeId: objectId,
    //                 objectId: objectId,
    //                 title: (name && name !== "" && name !== "Default")
    //                     ? name
    //                     : `${type}`,
    //                 type: type,
    //                 parentNode: typeNode,
    //                 numViewObjects: 0,
    //                 numVisibleViewObjects: 0,
    //                 checked: false,
    //                 xrayed: false,
    //                 childNodes: []
    //             };
    //             typeNode.childNodes.push(node);
    //             this._objectNodes[node.objectId] = node;
    //         }
    //     }
    // }

    if (aggregations) {
      for (let i = 0, len = aggregations.length; i < len; i++) {
        const aggregation = aggregations[i];
        const aggregatedDataObject = aggregation.relatedObject;
        this._buildTypesNodes2(aggregatedDataObject, rootNode, typeNodes);
      }
    }
  }

  _buildAggregationNodes() {
    const objects = this.data.objects;
    for (const objectId in objects) {
      const dataObject = objects[objectId];
      if (Object.keys(dataObject.relating).length === 0) {
        this._buildAggregationNodes2(dataObject, null);
      }
    }
  }

  _buildAggregationNodes2(dataObject: DataObject, parentNode: TreeViewNode | null) {

    if (this._pruneEmptyNodes && (!this._dataObjectSceneObjectCounts[dataObject.id])) {
      return;
    }

    const objectId = dataObject.id;
    const type = dataObject.type;
    const name = dataObject.name || type;
    const aggregations = dataObject.related[this._linkType];

    const node: TreeViewNode = {
      nodeId: objectId,
      objectId: objectId,
      title: (!parentNode)
        ? (this._rootName || name)
        : (name && name !== "" && name !== "Undefined" && name !== "Default")
          ? name
          : type,
      type: type,
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

    if (aggregations) {
      for (let i = 0, len = aggregations.length; i < len; i++) {
        const aggregation = aggregations[i];
        const aggregatedDataObject = aggregation.relatedObject;
        this._buildAggregationNodes2(aggregatedDataObject, node);
      }
    }
  }

  _doSortNodes() {
    for (let i = 0, len = this._rootNodes.length; i < len; i++) {
      const rootNode = this._rootNodes[i];
      this._sortChildNodes(rootNode);
    }
  }

  _sortChildNodes(node: TreeViewNode) {
    // const childNodes = node.childNodes;
    // if (!childNodes || childNodes.length === 0) {
    //     return;
    // }
    // if (this._hierarchy === "storeys" && node.type === "IfcBuilding") {
    //     // Assumes that childNodes of an IfcBuilding will always be IfcBuildingStoreys
    //     childNodes.sort(this._getSpatialSortFunc());
    // } else {
    //     childNodes.sort(this._alphaSortFunc);
    // }
    // for (let i = 0, len = childNodes.length; i < len; i++) {
    //     const node = childNodes[i];
    //     this._sortChildNodes(node);
    // }
  }

  _getSpatialSortFunc() { // Creates cached sort func with Viewer in scope
    // const viewer = this._viewer;
    // const scene = viewer.scene;
    // const camera = scene.camera;
    // const metaScene = viewer.metaScene;
    // return this._spatialSortFunc || (this._spatialSortFunc = (node1, node2) => {
    //     if (!node1.aabb || !node2.aabb) {
    //         // Sorting on lowest point of the AABB is likely more more robust when objects could overlap storeys
    //         if (!node1.aabb) {
    //             node1.aabb = scene.getAABB(metaScene.getObjectIDsInSubtree(node1.objectId));
    //         }
    //         if (!node2.aabb) {
    //             node2.aabb = scene.getAABB(metaScene.getObjectIDsInSubtree(node2.objectId));
    //         }
    //     }
    //     let idx = 0;
    //     if (camera.xUp) {
    //         idx = 0;
    //     } else if (camera.yUp) {
    //         idx = 1;
    //     } else {
    //         idx = 2;
    //     }
    //     if (node1.aabb[idx] > node2.aabb[idx]) {
    //         return -1;
    //     }
    //     if (node1.aabb[idx] < node2.aabb[idx]) {
    //         return 1;
    //     }
    //     return 0;
    // });
  }

  _alphaSortFunc(node1: TreeViewNode, node2: TreeViewNode): number {
    const title1 = node1.title.toUpperCase(); // FIXME: Should be case sensitive?
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
    const dataObjects = this.data.objects;
    const viewObjects = this.view.objects;
    for (let i = 0, len = objectIds.length; i < len; i++) {
      const objectId = objectIds[i];
      const dataObject = dataObjects[objectId];
      if (dataObject) {
        const node = this._objectNodes[objectId];
        if (node) {
          const viewObject = viewObjects[objectId];
          if (viewObject) {
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
            let parentNode = node.parentNode; // Synch parents
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
      }
    }
  }

  _withNodeTree(node: TreeViewNode, callback: (arg0: TreeViewNode) => void) {
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
    const rootNodeElements = this._rootNodes.map((rootNode) => {
      return this._createNodeElement(rootNode);
    });
    const ul = document.createElement('ul');
    rootNodeElements.forEach((nodeElement) => {
      ul.appendChild(nodeElement);
    });
    this._containerElement.appendChild(ul);
    this._rootElement = ul;
  }

  _createNodeElement(node: TreeViewNode): HTMLElement {
    const nodeElement = document.createElement('li');
    //const nodeId = this._objectToNodeID(node.objectId);
    const nodeId = node.nodeId;
    if (node.xrayed) {
      nodeElement.classList.add('xrayed-node');
    }
    nodeElement.id = 'node-' + nodeId;
    if (node.childNodes.length > 0) {
      const switchElementId = "switch-" + nodeId;
      const switchElement = document.createElement('a');
      switchElement.href = '_';
      switchElement.id = switchElementId;
      switchElement.textContent = '+';
      switchElement.classList.add('plus');
      switchElement.addEventListener('click', this._switchExpandHandler);
      nodeElement.appendChild(switchElement);
    }
    const checkbox = document.createElement('input');
    checkbox.id = nodeId;
    checkbox.type = "checkbox";
    checkbox.checked = node.checked;
    // @ts-ignore
    checkbox.style["pointer-events"] = "all";
    // @ts-ignore
    checkbox.addEventListener("change", this._checkboxChangeHandler);
    nodeElement.appendChild(checkbox);
    const span = document.createElement('span');
    span.textContent = node.title;
    nodeElement.appendChild(span);
    span.oncontextmenu = (e: MouseEvent) => {
      this.events.onContextMenu.dispatch(this, <TreeViewNodeContextMenuEvent>{
        event: e,
        treeView: this,
        treeViewNode: node
      });
      e.preventDefault();
    };
    span.onclick = (e: MouseEvent) => {
      this.events.onNodeTitleClicked.dispatch(this, <TreeViewNodeTitleClickedEvent>{
        event: e,
        treeView: this,
        treeViewNode: node
      });
      e.preventDefault();
    };
    return nodeElement;
  }

  _expandSwitchElement(switchElement: HTMLElement): void {
    const parentElement = switchElement.parentElement;
    if (!parentElement) {
      return;
    }
    const expanded = parentElement.getElementsByTagName('li')[0];
    if (expanded) {
      return;
    }
    const nodeId = parentElement.id.replace('node-', '');
    const objectId = nodeId;
    const switchNode = this._objectNodes[objectId];
    const childNodes = switchNode.childNodes;
    const nodeElements = childNodes.map((node) => {
      return this._createNodeElement(node);
    });
    const ul = document.createElement('ul');
    nodeElements.forEach((nodeElement) => {
      ul.appendChild(nodeElement);
    });
    parentElement.appendChild(ul);
    switchElement.classList.remove('plus');
    switchElement.classList.add('minus');
    switchElement.textContent = '-';
    switchElement.removeEventListener('click', this._switchExpandHandler);
    switchElement.addEventListener('click', this._switchCollapseHandler);
  }

  _collapseNode(objectId: string): void {
    const nodeId = objectId;
    const switchElementId = `switch-${nodeId}`;
    const switchElement = document.getElementById(switchElementId);
    if (!switchElement) {
      return;
    }
    this._collapseSwitchElement(switchElement);
  }

  _collapseSwitchElement(switchElement: HTMLElement): void {
    if (!switchElement) {
      return;
    }
    const parent = switchElement.parentElement;
    if (!parent) {
      return;
    }
    const ul = parent.querySelector('ul');
    if (!ul) {
      return;
    }
    parent.removeChild(ul);
    switchElement.classList.remove('minus');
    switchElement.classList.add('plus');
    switchElement.textContent = '+';
    switchElement.removeEventListener('click', this._switchCollapseHandler);
    switchElement.addEventListener('click', this._switchExpandHandler);
  }
}

