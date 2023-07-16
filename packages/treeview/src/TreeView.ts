import type {View, Viewer, ViewObject} from "@xeokit/viewer";
import {Component, EventEmitter} from "@xeokit/core";
import type {Data, DataModel, DataObject} from "@xeokit/data";
import {EventDispatcher} from "strongly-typed-events";

/**
 * Parameters to create a {@link @xeokit/treeview!TreeView | TreeView}.
 */
export interface TreeViewParams {

    /**
     * The {@link @xeokit/viewer!View | View} that contains the {@link @xeokit/viewer!ViewObjects | ViewObjects}
     * navigated by the {@link @xeokit/treeview!TreeView | TreeView}.
     */
    view: View;

    /**
     * The semantic {@link @xeokit/data!Data | Data} model that determines the structure of the {@link @xeokit/treeview!TreeView | TreeView}.
     */
    data: Data;

    /**
     *
     */
    containerElement: HTMLElement;

    /**
     *
     */
    includeLayerIds?: string[];

    /**
     *
     */
    excludeLayerIds?: string[];

    /**
     * When traversing the {@link @xeokit/data!Data | Data} to build the tree UI nodes, at each
     * {@link @xeokit/data!DataObject | DataObjects}, the {@link @xeokit/treeview!TreeView | TreeView} will traverse only the outgoing
     * {@link @xeokit/data!Relationship| Relationships} of this type in
     * {@link @xeokit/data!DataObject.relating | DataObject.relating}.
     */
    linkType: number,

    /**
     * When traversing the {@link @xeokit/data!Data | Data} to build the tree UI nodes for a {@link @xeokit/treeview!TreeView.GroupsHierarchy | GroupsHierarchy}
     * hierarchy, these are the values of {@link @xeokit/data!DataObject.type | DataObject.type} that the
     * {@link @xeokit/treeview!TreeView | TreeView} groups the {@link @xeokit/data!DataObject | DataObjects} on.
     *
     * The grouping for the {@link @xeokit/treeview!TreeView.GroupsHierarchy | GroupsHierarchy} hierarchy has two levels. The major grouping type is given
     * in ````groupTypes[0]```` and the minor grouping type is given in ````storeyGroups[1]````.
     */
    groupTypes: number[]

    /**
     * {@link @xeokit/data!DataObject.type | DataObject.type}
     *
     * TODO
     *
     * * {@link TreeView.AggregationHierarchy}
     * * {@link TreeView.TypesHierarchy}
     * * {@link TreeView.GroupsHierarchy}
     */
    hierarchy: number;

    rootName?: string;
    pruneEmptyNodes?: boolean;
    sortNodes?: boolean;
    autoExpandDepth?: number;
}

/**
 * A node in a TreeView.
 */
export interface TreeViewNode {
    nodeId: string;
    objectId: string;
    title: string;
    type: number;
    parentNode: TreeViewNode | null;
    numViewObjects: number;
    numVisibleViewObjects: number;
    checked: boolean;
    xrayed: boolean;
    childNodes: TreeViewNode[];
}

/**
 * Event fired by {@link TreeView.onNodeTitleClicked}.
 */
interface TreeViewNodeTitleClickedEvent {
    event: Event;
    treeView: TreeView;
    treeViewNode: TreeViewNode;
}

/**
 * Event fired by {@link TreeView.onContextMenu}.
 */
export interface TreeViewNodeContextMenuEvent {
    event: Event;
    treeView: TreeView;
    treeViewNode: TreeViewNode;
}


/**
 * An HTMl tree view that navigates the {@link @xeokit/data!DataObject | DataObjects} in the given
 * {@link @xeokit/data!Data | Data}, while controlling the visibility of their corresponding
 * {@link @xeokit/viewer!ViewObject | ViewObjects} in the given {@link @xeokit/viewer!View | View}.
 *
 * See {@link "@xeokit/treeview"} for usage.
 */
export class TreeView extends Component {

    /**
     * Hierarchy mode that arranges the {@link TreeViewNode | TreeViewNodes} as an aggregation hierarchy.
     *
     * The mode creates a TreeViewNode hierarchy that mirrors that of the
     * {@link @xeokit/data!DataObject | DataObjects} and
     * aggregation {@link @xeokit/data!Relationship | Relationships} in the {@link @xeokit/data!Data | Data}.
     *
     * In this hierarchy, each TreeViewNode corresponds to a DataObject in the Data. The TreeViewNodes are connected
     * into a hierarchy that reflects a depth-first traversal from the root DataObjects that follows each DataObject's
     * outgoing Relationships of the type given in {@link TreeView.linkType | TreeView.linkType}.
     */
    static AggregationHierarchy: 0;

    /**
     * Hierarchy mode that groups the {@link TreeViewNode | TreeViewNodes} by type.
     *
     * This mode creates a two-level hierarchy. At the root level, we get TreeViewNodes that represent each of the
     * distinct types in our {@link @xeokit/data!Data | Data}. Each of those gets one or more child TreeViewNodes
     * that represent {@link @xeokit/data!DataObject | DataObjects} of that type. When those DataObjects have
     * {@link @xeokit/viewer!ViewObject | ViewObjects} of the same ID, then the TreeViewNodes will have checkboxes
     * that we can use to show, hide, and X-ray their ViewObjects.
     */
    static TypesHierarchy: 1;

    /**
     * Hierarchy mode that arranges the {@link TreeViewNode | TreeViewNodes} into an n-level grouped hierarchy.
     *
     * This mode creates a multi-level grouped hierarchy, following the order given
     * in {@link TreeViewParams.groupTypes | TreeViewParams.groupTypes}. The TreeViewNodes at level 0 are all the same
     * type as ````TreeViewParams.groupTypes[0]````, TreeViewNodes at level 1 are all the same type
     * as ````TreeViewParams.groupTypes[2]````, and so on. Once descended beyond the length of ````TreeViewParams.groupTypes````,
     * the TreeViewNodes are just grouped by type.
     */
    static GroupsHierarchy: 2;

    /**
     * The semantic {@link @xeokit/data!Data | Data} model that determines the structure of this TreeView.
     */
    data: Data;

    /**
     * The {@link @xeokit/viewer!View | View} that contains the {@link @xeokit/viewer!ViewObject | ViewObjects}
     * navigated by this TreeView.
     */
    view: View;

    /**
     * Emits an event each time the title of a node is clicked in the tree view.
     *
     * @event
     */
    readonly onNodeTitleClicked: EventEmitter<TreeView, TreeViewNodeTitleClickedEvent>;

    /**
     * Emits an event each time we right-click on a tree node.
     *
     * @event
     */
    readonly onContextMenu: EventEmitter<TreeView, TreeViewNodeContextMenuEvent>;

    /**
     * Emits an event when this TreeView has been destroyed.
     *
     * Triggered by {@link TreeView.destroy}.
     *
     * @event
     */
    declare readonly onDestroyed: EventEmitter<TreeView, null>;

    #linkType: number;
    #groupTypes: number[];
    #containerElement: HTMLElement;
    #hierarchy: number;
    #dataModels: {
        [key: string]: DataModel
    };
    #autoAddModels: boolean;
    #autoExpandDepth: any;
    #sortNodes: boolean | undefined;
    #pruneEmptyNodes: boolean;
    #viewer: Viewer;
    #rootElement: HTMLUListElement | null;
    #muteSceneEvents: boolean;
    #muteTreeEvents: boolean;
    #rootNodes: any[];
    #objectNodes: {
        [key: string]: TreeViewNode
    };
    #rootName: any;
    #showListItemElementId: string | null;
    #spatialSortFunc: (node1: TreeViewNode, node2: TreeViewNode) => (number);
    #switchExpandHandler: (event: MouseEvent) => void;
    #switchCollapseHandler: (event: MouseEvent) => void;
    #checkboxChangeHandler: (event: MouseEvent) => void;
    #destroyed: boolean;
    #onViewObjectVisibility: () => void;
    #onViewObjectXRayed: () => void;

    #dataObjectSceneObjectCounts: { [key: string]: number };

    /**
     *
     * TODO
     *
     * @param params
     */
    constructor(params: TreeViewParams) {

        super(null);

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

        this.#viewer = params.view.viewer;
        this.#linkType = params.linkType;
        this.#groupTypes = params.groupTypes;
        this.#hierarchy = TreeView.AggregationHierarchy;
        this.#containerElement = params.containerElement;
        this.#dataModels = {};
        this.#autoExpandDepth = (params.autoExpandDepth || 0);
        this.#sortNodes = (params.sortNodes !== false);
        this.#pruneEmptyNodes = (params.pruneEmptyNodes !== false);
        this.#rootElement = null;
        this.#muteSceneEvents = false;
        this.#muteTreeEvents = false;
        this.#rootNodes = [];
        this.#objectNodes = {}; // Object ID -> TreeViewNode
        this.#rootName = params.rootName;
        this.#sortNodes = params.sortNodes;
        // @ts-ignore
        this.#pruneEmptyNodes = params.pruneEmptyNodes;
        // @ts-ignore
        this.#showListItemElementId = null;
        this.#destroyed = false;

        this.onNodeTitleClicked = new EventEmitter(new EventDispatcher<TreeView, TreeViewNodeTitleClickedEvent>());
        this.onContextMenu = new EventEmitter(new EventDispatcher<TreeView, TreeViewNodeContextMenuEvent>());
        this.onDestroyed = new EventEmitter(new EventDispatcher<TreeView, null>());

        this.#containerElement.oncontextmenu = (e) => {
            e.preventDefault();
        };

        this.#onViewObjectVisibility = this.view.onObjectVisibility.subscribe((view: View, viewObject: ViewObject) => {
            if (this.#muteSceneEvents) {
                return;
            }
            const objectId = viewObject.id;
            // @ts-ignore
            const node = this.#objectNodes[objectId];
            if (!node) {
                return; // Not in this tree
            }
            const visible = viewObject.visible;
            const updated = (visible !== node.checked);
            if (!updated) {
                return;
            }
            this.#muteTreeEvents = true;
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
            this.#muteTreeEvents = false;
        });

        this.#onViewObjectXRayed = this.view.onObjectXRayed.subscribe((view: View, viewObject: ViewObject) => {
            if (this.#muteSceneEvents) {
                return;
            }
            const objectId = viewObject.id;
            const node = this.#objectNodes[objectId];
            if (!node) {
                return; // Not in this tree
            }
            this.#muteTreeEvents = true;
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
            this.#muteTreeEvents = false;
        });

        this.#switchExpandHandler = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            const switchElement = (<HTMLElement>event.target);
            this.#expandSwitchElement(switchElement);
        };

        this.#switchCollapseHandler = (event) => {
            event.preventDefault();
            event.stopPropagation();
            const switchElement = (<HTMLElement>event.target);
            this.#collapseSwitchElement(switchElement);
        };

        this.#checkboxChangeHandler = (event: any) => {
            if (this.#muteTreeEvents) {
                return;
            }
            this.#muteSceneEvents = true;
            const checkbox = event.target;
            const visible = checkbox.checked;
            const nodeId = checkbox.id;
            const checkedObjectId = nodeId;
            const checkedNode = this.#objectNodes[checkedObjectId];
            const objects = this.view.objects;
            let numUpdated = 0;
            this.#withNodeTree(checkedNode, (node: TreeViewNode) => {
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
            this.#muteSceneEvents = false;
        };

        this.hierarchy = params.hierarchy;

        const modelIds = Object.keys(this.data.models);
        for (let i = 0, len = modelIds.length; i < len; i++) {
            const modelId = modelIds[i];
            this.#addModel(modelId);
        }

        this.#viewer.scene.onModelCreated.subscribe((scene, sceneModel) => {
            if (this.data.models[sceneModel.id]) {
                this.#addModel(sceneModel.id);
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
        return this.#hierarchy;
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
            this.error("Unsupported value for `hierarchy' - defaulting to TreeView.AggregationHierarchy ");
            hierarchy = TreeView.AggregationHierarchy;
        }
        if (this.#hierarchy === hierarchy) {
            return;
        }
        this.#hierarchy = hierarchy;
        this.#rebuildNodes();
    }

    /**
     * When traversing the {@link @xeokit/data!Data | Data} to build the tree UI nodes, at each
     * {@link @xeokit/data!DataObject | DataObjects}, the TreeView will traverse only the outgoing
     * {@link @xeokit/data!Relationship | Relationships} of this type in
     * {@link @xeokit/data!DataObject.relating | DataObject.relating}.
     */
    get linkType(): number {
        return this.#linkType;
    }

    /**
     * When traversing the {@link @xeokit/data!Data | Data} to build the tree UI nodes, at each
     * {@link @xeokit/data!DataObject | DataObjects}, the TreeView will traverse only the outgoing
     * {@link @xeokit/data!Relationship | Relationships} of this type in
     * {@link @xeokit/data!DataObject.relating | DataObject.relating}.
     */
    set linkType(linkType: number) {
        if (this.#linkType === linkType) {
            return;
        }
        this.#linkType = linkType;
        this.#rebuildNodes();
    }

    /**
     * When traversing the {@link @xeokit/data!Data | Data} to build the tree UI nodes for
     * a {@link TreeView.GroupsHierarchy}, these are the values
     * of {@link @xeokit/data!DataObject.type | DataObject.type} that the
     * TreeView groups and subgroups the {@link @xeokit/data!DataObject | DataObjects} on.
     *
     * The grouping for {@link TreeView.GroupsHierarchy} has two levels. The major grouping type is given
     * in ````groupTypes[0]```` and the minor grouping type is given in ````storeyGroups[1]````.
     *
     * Example: ````[IfcBuilding, IfcBuildingStorey]````.
     */
    get groupTypes(): number [] {
        return this.#groupTypes;
    }

    /**
     * When traversing the {@link @xeokit/data!Data | Data} to build the tree UI nodes for
     * a {@link TreeView.GroupsHierarchy}, these are the values
     * of {@link @xeokit/data!DataObject.type | DataObject.type} that the
     * TreeView groups and subgroups the {@link @xeokit/data!DataObject | DataObjects} on.
     *
     * The grouping for the {@link @xeokit/treeview!TreeView.GroupsHierarchy | GroupsHierarchy} hierarchy has two levels. The major grouping type is given
     * in ````groupTypes[0]```` and the minor grouping type is given in ````storeyGroups[1]````.
     *
     * Example: ````[IfcBuilding, IfcBuildingStorey]````.
     */
    set groupTypes(groupTypes: number[]) {
        if (this.#groupTypes === groupTypes) {
            return;
        }
        this.#groupTypes = groupTypes;
        if (this.#hierarchy === TreeView.GroupsHierarchy) {
            this.#rebuildNodes();
        }
    }

    /**
     * Highlights the tree view node that represents the given object {@link viewObject}.
     *
     * This causes the tree view to collapse, then expand to reveal the node, then highlight the node.
     *
     * If a node is previously highlighted, de-highlights that node and collapses the tree first.
     *
     * Note that if the TreeView was configured with ````pruneEmptyNodes: true```` (default configuration), then the
     * node won't exist in the tree if it has no viewObjects in the {@link @xeokit/scene!Scene}. in that case, nothing will happen.
     *
     * Within the DOM, the node is represented by an ````<li>```` element. This method will add a ````.highlighted-node```` class to
     * the element to make it appear highlighted, removing that class when de-highlighting it again. See the CSS rules
     * in the TreeView webifcviewer for an example of that class.
     *
     * @param {String} objectId ID of the {@link viewObject}.
     */
    showNode(objectId: string): void {
        if (this.#showListItemElementId) {
            this.unShowNode();
        }
        const node = this.#objectNodes[objectId];
        if (!node) {
            return; // TreeViewNode may not exist for the given object if (this.#pruneEmptyNodes == true)
        }
        const nodeId = node.nodeId;
        const switchElementId = "switch-" + nodeId;
        const switchElement = document.getElementById(switchElementId);
        if (switchElement) {
            this.#expandSwitchElement(switchElement);
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
                this.#expandSwitchElement(switchElement);
            }
        }
        const listItemElementId = 'node-' + nodeId;
        const listItemElement = document.getElementById(listItemElementId);
        // @ts-ignore
        listItemElement.scrollIntoView({block: "center"});
        // @ts-ignore
        listItemElement.classList.add("highlighted-node");
        this.#showListItemElementId = listItemElementId;
    }

    /**
     * De-highlights the node previously shown with {@link TreeView#showNode}.
     *
     * Does nothing if no node is currently shown.
     *
     * If the node is currently scrolled into view, keeps the node in view.
     */
    unShowNode(): void {
        if (!this.#showListItemElementId) {
            return;
        }
        const listItemElement = document.getElementById(this.#showListItemElementId);
        if (!listItemElement) {
            this.#showListItemElementId = null;
            return;
        }
        listItemElement.classList.remove("highlighted-node");
        this.#showListItemElementId = null;
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
                this.#expandSwitchElement(switchElement);
                const childNodes = node.childNodes;
                for (let i = 0, len = childNodes.length; i < len; i++) {
                    const childNode = childNodes[i];
                    expand(childNode, countDepth + 1);
                }
            }
        };
        for (let i = 0, len = this.#rootNodes.length; i < len; i++) {
            const rootNode = this.#rootNodes[i];
            expand(rootNode, 0);
        }
    }

    /**
     * Closes all the nodes in the tree.
     */
    collapse(): void {
        for (let i = 0, len = this.#rootNodes.length; i < len; i++) {
            const rootNode = this.#rootNodes[i];
            const objectId = rootNode.objectId;
            this.#collapseNode(objectId);
        }
    }

    /**
     * Destroys this TreeView.
     */
    destroy(): void {
        if (!this.#containerElement) {
            return;
        }
        this.#dataModels = {};
        if (this.#rootElement && !this.#destroyed) {
            // @ts-ignore
            this.#rootElement.parentNode.removeChild(this.#rootElement);
            this.view.onObjectVisibility.unsubscribe(this.#onViewObjectVisibility);
            this.view.onObjectXRayed.unsubscribe(this.#onViewObjectXRayed);
            this.#destroyed = true;
        }
        super.destroy();
    }

    /**
     * Adds a model to this tree view.
     *
     * @private
     * @param {String} modelId ID of a model {@link viewObject} in {@link @xeokit/scene!Scene#models}.
     * @param {Object} [options] Options for model in the tree view.
     * @param {String} [options.rootName] Optional display name for the root node. Ordinary, for "containment"
     * and {@link @xeokit/treeview!TreeView.GroupsHierarchy | GroupsHierarchy} hierarchy types, the tree would derive the root node name from the model's "IfcProject" element
     * name. This option allows to override that name when it is not suitable as a display name.
     */
    #addModel(modelId: string, options = {}): void {
        if (!this.#containerElement) {
            return;
        }
        const model = this.#viewer.scene.models[modelId];
        if (!model) {
            this.error(`SceneModel not found: ${modelId}`);
            return;
        }
        const dataModel = this.data.models[modelId];
        if (!dataModel) {
            this.error(`DataModel not found: ${modelId}`);
            return;
        }
        if (this.#dataModels[modelId]) {
            this.error(`Model already added: ${modelId}`);
            return;
        }
        this.#dataModels[modelId] = dataModel;
        model.onDestroyed.one(() => {
            this.#removeModel(model.id);
        });
        this.#rebuildNodes();
    }

    /**
     * Removes a model from this tree view.
     *
     * @private
     * @param {String} modelId ID of a model {@link viewObject} in {@link @xeokit/scene!Scene#models}.
     */
    #removeModel(modelId: string): void {
        if (!this.#containerElement) {
            return;
        }
        const dataModel = this.#dataModels[modelId];
        if (!dataModel) {
            return;
        }
        delete this.#dataModels[modelId];
        this.#rebuildNodes();
    }

    #rebuildNodes(): void {
        if (this.#rootElement) {
            // @ts-ignore
            this.#rootElement.parentNode.removeChild(this.#rootElement);
            this.#rootElement = null;
        }

        this.#rootNodes = [];
        this.#objectNodes = {};
        if (this.#validate()) {
            this.#createEnabledNodes();
        } else {
            this.#createDisabledNodes();
        }
    }

    #validate(): boolean {
        let valid = true;
        switch (this.#hierarchy) {
            case TreeView.GroupsHierarchy:
                valid = (this.#rootNodes.length > 0);
                //   valid = this.#validateMetaModelForStoreysHierarchy();
                break;
            case TreeView.TypesHierarchy:
                valid = (this.#rootNodes.length > 0);
                break;
            case TreeView.AggregationHierarchy:
            default:
                valid = (this.#rootNodes.length > 0);
                break;
        }
        return valid;
    }

    #validateMetaModelForStoreysHierarchy(level = 0, ctx: any, buildingNode: any) {
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
        //         if (!this.#validateMetaModelForStoreysHierarchy(aggregatedDataObject, errors, level + 1, ctx, buildingNode)) {
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

    #createEnabledNodes(): void {
        if (this.#pruneEmptyNodes) {
            this.#findEmptyNodes();
        }
        switch (this.#hierarchy) {
            case TreeView.GroupsHierarchy:
                this.#buildGroupsNodes();
                if (this.#rootNodes.length === 0) {
                    this.error("Failed to build hierarchy TreeView.GroupsHierarchy");
                }
                break;
            case TreeView.TypesHierarchy:
                this.#buildTypesNodes();
                break;
            case TreeView.AggregationHierarchy:
            default:
                this.#buildAggregationNodes();
        }
        if (this.#sortNodes) {
            this.#doSortNodes();
        }
        this.#synchNodesToEntities();
        this.#createNodeElements();
        this.expandToDepth(this.#autoExpandDepth);
    }

    #createDisabledNodes(): void { // Creates empty HTML nodes for data graph roots
        const rootDataObjects = this.data.rootObjects;
        for (let objectId in rootDataObjects) {
            const dataObject = rootDataObjects[objectId];
            const dataObjectType = dataObject.type;
            const name = dataObject.name;
            const rootName = (name && name !== "" && name !== "Undefined" && name !== "Default") ? name : `${dataObjectType}`; // TODO: type is a number - needs to be human-readable
            const ul = document.createElement('ul');
            const li = document.createElement('li');
            ul.appendChild(li);
            this.#containerElement.appendChild(ul);
            this.#rootElement = ul;
            const switchElement = document.createElement('a');
            switchElement.href = '#';
            switchElement.textContent = '!';
            switchElement.classList.add('warn');
            switchElement.classList.add('warning');
            li.appendChild(switchElement);
            const span = document.createElement('span');
            span.textContent = rootName;
            li.appendChild(span);
        }
    }

    #findEmptyNodes(): void {
        const rootDataObjects = this.data.rootObjects;
        for (let objectId in rootDataObjects) {
            this.#findEmptyNodes2(rootDataObjects[objectId]);
        }
    }

    #findEmptyNodes2(dataObject: DataObject): number {
        const viewer = this.#viewer;
        const scene = viewer.scene;
        const aggregations = dataObject.related[this.#linkType];
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
                const aggregatedCount = this.#findEmptyNodes2(aggregatedDataObject);
                this.#dataObjectSceneObjectCounts[aggregatedDataObject.id] = aggregatedCount;
                sceneObjectCounts += aggregatedCount;
            }
        }
        this.#dataObjectSceneObjectCounts[dataObject.id] = sceneObjectCounts;
        return sceneObjectCounts;
    }

    #buildGroupsNodes(): void {
        const rootDataObjects = this.data.rootObjects;
        for (let id in rootDataObjects) {
            this.#buildGroupsNodes2(rootDataObjects[id], [], null, null, null);
        }
    }

    #buildGroupsNodes2(
        dataObject: DataObject,
        pathNodes: TreeViewNode[],
        buildingNode: TreeViewNode | null,
        storeyNode: TreeViewNode | null,
        typeNodes: { [key: number]: TreeViewNode } | null) {

        if (this.#pruneEmptyNodes && (!this.#dataObjectSceneObjectCounts[dataObject.id])) {
            return;
        }

        const objectId = dataObject.id;
        const type = dataObject.type;
        const name = dataObject.name;
        const aggregations = dataObject.related[this.#linkType];

        if (pathNodes.length < this.#groupTypes.length) {
            const groupType = this.#groupTypes[pathNodes.length];
            if (pathNodes.length === 0) {
                if (type === groupType) {
                    const node: TreeViewNode = {
                        nodeId: objectId,
                        objectId,
                        title: this.#rootName || ((name && name !== "" && name !== "Undefined" && name !== "Default") ? name : type),
                        type,
                        parentNode: null,
                        numViewObjects: 0,
                        numVisibleViewObjects: 0,
                        checked: false,
                        xrayed: false,
                        childNodes: []
                    };
                    pathNodes.push(node);
                    this.#rootNodes.push(node);
                    this.#objectNodes[node.objectId] = node;
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
                    this.#objectNodes[node.objectId] = node;
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
                    this.#objectNodes[typeNodeObjectId] = typeNode;
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
                this.#objectNodes[leafNode.objectId] = leafNode;
            }
        }

        if (aggregations) {
            for (let i = 0, len = aggregations.length; i < len; i++) {
                const aggregation = aggregations[i];
                const aggregatedDataObject = aggregation.relatedObject;
                this.#buildGroupsNodes2(aggregatedDataObject, pathNodes, buildingNode, storeyNode, typeNodes);
            }
        }
    }

    #buildTypesNodes() {
        const rootDataObjects = this.data.rootObjects;
        for (let id in rootDataObjects) {
            this.#buildTypesNodes2(rootDataObjects[id], null, null);
        }
    }

    #buildTypesNodes2(dataObject: DataObject, rootNode: TreeViewNode | null, typeNodes: { [key: string | number]: TreeViewNode } | null) {

        if (this.#pruneEmptyNodes && (!this.#dataObjectSceneObjectCounts[dataObject.id])) {
            return;
        }

        const objectId = dataObject.id;
        const type = dataObject.type;
        const name = dataObject.name;
        const aggregations = dataObject.related[this.#linkType];

        // if (dataObject.id === this.#rootdataObject.id) {
        //     rootNode = {
        //         nodeId: objectId,
        //         objectId: objectId,
        //         title: this.#rootName || ((name && name !== "" && name !== "Undefined" && name !== "Default")
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
        //     this.#rootNodes.push(rootNode);
        //     this.#objectNodes[rootNode.objectId] = rootNode;
        //     typeNodes = {};
        // } else {
        //     if (rootNode) {
        //         const objects = this.#viewer.scene.objects;
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
        //                 this.#objectNodes[typeNode.objectId] = typeNode;
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
        //             this.#objectNodes[node.objectId] = node;
        //         }
        //     }
        // }

        if (aggregations) {
            for (let i = 0, len = aggregations.length; i < len; i++) {
                const aggregation = aggregations[i];
                const aggregatedDataObject = aggregation.relatedObject;
                this.#buildTypesNodes2(aggregatedDataObject, rootNode, typeNodes);
            }
        }
    }

    #buildAggregationNodes() {
        const rootDataObjects = this.data.rootObjects;
        for (let id in rootDataObjects) {
            this.#buildAggregationNodes2(rootDataObjects[id], null);
        }
    }

    #buildAggregationNodes2(dataObject: DataObject, parentNode: TreeViewNode | null) {

        if (this.#pruneEmptyNodes && (!this.#dataObjectSceneObjectCounts[dataObject.id])) {
            return;
        }

        const objectId = dataObject.id;
        const type = dataObject.type;
        const name = dataObject.name || type;
        const aggregations = dataObject.related[this.#linkType];

        const node: TreeViewNode = {
            nodeId: objectId,
            objectId: objectId,
            title: (!parentNode)
                ? (this.#rootName || name)
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
            this.#rootNodes.push(node);
        }
        this.#objectNodes[node.objectId] = node;

        if (aggregations) {
            for (let i = 0, len = aggregations.length; i < len; i++) {
                const aggregation = aggregations[i];
                const aggregatedDataObject = aggregation.relatedObject;
                this.#buildAggregationNodes2(aggregatedDataObject, node);
            }
        }
    }

    #doSortNodes() {
        for (let i = 0, len = this.#rootNodes.length; i < len; i++) {
            const rootNode = this.#rootNodes[i];
            this.#sortChildNodes(rootNode);
        }
    }

    #sortChildNodes(node: TreeViewNode) {
        // const childNodes = node.childNodes;
        // if (!childNodes || childNodes.length === 0) {
        //     return;
        // }
        // if (this.#hierarchy === "storeys" && node.type === "IfcBuilding") {
        //     // Assumes that childNodes of an IfcBuilding will always be IfcBuildingStoreys
        //     childNodes.sort(this.#getSpatialSortFunc());
        // } else {
        //     childNodes.sort(this.#alphaSortFunc);
        // }
        // for (let i = 0, len = childNodes.length; i < len; i++) {
        //     const node = childNodes[i];
        //     this.#sortChildNodes(node);
        // }
    }

    #getSpatialSortFunc() { // Creates cached sort func with Viewer in scope
        // const viewer = this.#viewer;
        // const scene = viewer.scene;
        // const camera = scene.camera;
        // const metaScene = viewer.metaScene;
        // return this.#spatialSortFunc || (this.#spatialSortFunc = (node1, node2) => {
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

    #alphaSortFunc(node1: TreeViewNode, node2: TreeViewNode): number {
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

    #synchNodesToEntities(): void {
        const objectIds = Object.keys(this.data.objects);
        const dataObjects = this.data.objects;
        const viewObjects = this.view.objects;
        for (let i = 0, len = objectIds.length; i < len; i++) {
            const objectId = objectIds[i];
            const dataObject = dataObjects[objectId];
            if (dataObject) {
                const node = this.#objectNodes[objectId];
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

    #withNodeTree(node: TreeViewNode, callback: (arg0: TreeViewNode) => void) {
        callback(node);
        const childNodes = node.childNodes;
        if (!childNodes) {
            return;
        }
        for (let i = 0, len = childNodes.length; i < len; i++) {
            this.#withNodeTree(childNodes[i], callback);
        }
    }

    #createNodeElements(): void {
        if (this.#rootNodes.length === 0) {
            return;
        }
        const rootNodeElements = this.#rootNodes.map((rootNode) => {
            return this.#createNodeElement(rootNode);
        });
        const ul = document.createElement('ul');
        rootNodeElements.forEach((nodeElement) => {
            ul.appendChild(nodeElement);
        });
        this.#containerElement.appendChild(ul);
        this.#rootElement = ul;
    }

    #createNodeElement(node: TreeViewNode): HTMLElement {
        const nodeElement = document.createElement('li');
        //const nodeId = this.#objectToNodeID(node.objectId);
        const nodeId = node.nodeId;
        if (node.xrayed) {
            nodeElement.classList.add('xrayed-node');
        }
        nodeElement.id = 'node-' + nodeId;
        if (node.childNodes.length > 0) {
            const switchElementId = "switch-" + nodeId;
            const switchElement = document.createElement('a');
            switchElement.href = '#';
            switchElement.id = switchElementId;
            switchElement.textContent = '+';
            switchElement.classList.add('plus');
            switchElement.addEventListener('click', this.#switchExpandHandler);
            nodeElement.appendChild(switchElement);
        }
        const checkbox = document.createElement('input');
        checkbox.id = nodeId;
        checkbox.type = "checkbox";
        checkbox.checked = node.checked;
        // @ts-ignore
        checkbox.style["pointer-events"] = "all";
        // @ts-ignore
        checkbox.addEventListener("change", this.#checkboxChangeHandler);
        nodeElement.appendChild(checkbox);
        const span = document.createElement('span');
        span.textContent = node.title;
        nodeElement.appendChild(span);
        span.oncontextmenu = (e: MouseEvent) => {
            this.onContextMenu.dispatch(this, <TreeViewNodeContextMenuEvent>{
                event: e,
                treeView: this,
                treeViewNode: node
            });
            e.preventDefault();
        };
        span.onclick = (e: MouseEvent) => {
            this.onNodeTitleClicked.dispatch(this, <TreeViewNodeTitleClickedEvent>{
                event: e,
                treeView: this,
                treeViewNode: node
            });
            e.preventDefault();
        };
        return nodeElement;
    }

    #expandSwitchElement(switchElement: HTMLElement): void {
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
        const switchNode = this.#objectNodes[objectId];
        const childNodes = switchNode.childNodes;
        const nodeElements = childNodes.map((node) => {
            return this.#createNodeElement(node);
        });
        const ul = document.createElement('ul');
        nodeElements.forEach((nodeElement) => {
            ul.appendChild(nodeElement);
        });
        parentElement.appendChild(ul);
        switchElement.classList.remove('plus');
        switchElement.classList.add('minus');
        switchElement.textContent = '-';
        switchElement.removeEventListener('click', this.#switchExpandHandler);
        switchElement.addEventListener('click', this.#switchCollapseHandler);
    }

    #collapseNode(objectId: string): void {
        const nodeId = objectId;
        const switchElementId = `switch-${nodeId}`;
        const switchElement = document.getElementById(switchElementId);
        if (!switchElement) {
            return;
        }
        this.#collapseSwitchElement(switchElement);
    }

    #collapseSwitchElement(switchElement: HTMLElement): void {
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
        switchElement.removeEventListener('click', this.#switchCollapseHandler);
        switchElement.addEventListener('click', this.#switchExpandHandler);
    }
}

