import type {TreeView} from "./TreeView";
import {EventEmitter, type SDKResult} from "../core";
import {EventDispatcher} from "strongly-typed-events";
import type {TreeViewNodeTitleClickedEvent} from "./TreeViewNodeTitleClickedEvent";
import type {TreeViewNodeContextMenuEvent} from "./TreeViewNodeContextMenuEvent";

/**
 * Events emitted by a {@link treeview!TreeView | TreeView}.
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
    }

    /**
     * @private
     */
    destroy() {
        this.onError.clear();
        this.log.clear();
        this.onNodeTitleClicked.clear();
        this.onTreeViewDestroyed.clear();
        this.log.clear();
    }
}
