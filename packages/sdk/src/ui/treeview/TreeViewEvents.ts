import type {TreeView} from "./TreeView";
import {EventEmitter, type SDKResult} from "../../base/core";
import {EventDispatcher} from "strongly-typed-events";
import type {TreeViewNodeTitleClickedEvent} from "./TreeViewNodeTitleClickedEvent";
import type {TreeViewNodeContextMenuEvent} from "./TreeViewNodeContextMenuEvent";

/**
 * Events emitted by a {@link ui!treeview.TreeView | TreeView}.
 */
export class TreeViewEvents {

    /**
     * Emits an event when an error occurs within the `TreeView` or its components. This non-fatal event
     * is fired with an `SDKResult` containing error details whenever any operation fails.
     */
    public readonly onError: EventEmitter<TreeView, SDKResult<any>>;

    /**
     * Emits an event each time a message is logged.
     */
    public readonly log: EventEmitter<TreeView, string>;
  public readonly onNodeTitleClicked: EventEmitter<TreeView, TreeViewNodeTitleClickedEvent>;
  public readonly onContextMenu: EventEmitter<TreeView, TreeViewNodeContextMenuEvent>;

  /**
   * Emits when the user clicks the per-row **Select** button —
   * host typically toggles the matching `ViewObject`s' `selected`
   * state. Payload reuses {@link TreeViewNodeTitleClickedEvent}
   * so callers have one shape to switch on.
   */
  public readonly onNodeSelectClicked: EventEmitter<TreeView, TreeViewNodeTitleClickedEvent>;

  /**
   * Emits when the user clicks the per-row **Frame** button —
   * host typically jumps a {@link CameraFlightAnimation} to the
   * union AABB of the matching `ViewObject`s.
   */
  public readonly onNodeFrameClicked: EventEmitter<TreeView, TreeViewNodeTitleClickedEvent>;

  /**
   * Emits an event when the TreeView is destroyed.
   */
  readonly onTreeViewDestroyed: EventEmitter<TreeView, boolean>;

  /**
     * @private
     */
    constructor() {
        this.onError = new EventEmitter<TreeView, SDKResult<any>>(new EventDispatcher<TreeView, SDKResult<any>>());
       this.onTreeViewDestroyed = new EventEmitter(new EventDispatcher<TreeView, boolean>());
         this.log = new EventEmitter(new EventDispatcher<TreeView, string>());
      this.onNodeTitleClicked = new EventEmitter(new EventDispatcher<TreeView, TreeViewNodeTitleClickedEvent>());
      this.onContextMenu = new EventEmitter(new EventDispatcher<TreeView, TreeViewNodeContextMenuEvent>());
      this.onNodeSelectClicked = new EventEmitter(new EventDispatcher<TreeView, TreeViewNodeTitleClickedEvent>());
      this.onNodeFrameClicked  = new EventEmitter(new EventDispatcher<TreeView, TreeViewNodeTitleClickedEvent>());
    }

    /**
     * @private
     */
    destroy() {
        this.onError.clear();
        this.log.clear();
        this.onNodeTitleClicked.clear();
        this.onContextMenu.clear();
        this.onNodeSelectClicked.clear();
        this.onNodeFrameClicked.clear();
        this.onTreeViewDestroyed.clear();
    }
}
