/**
 * Declarative description of a Toolbar action.
 *
 * Each entry in the {@link TOOLBAR_ACTIONS} registry pairs a
 * stable {@link ToolbarAction} id with a `do` implementation
 * that receives a {@link ToolbarActionContext}. Adding a new
 * Toolbar button is now a matter of authoring a new descriptor
 * file and registering it — no edits to `Toolbar.ts` required.
 *
 * @module demo/toolbar/actions/ToolbarActionDescriptor
 */

import type {ToolbarAction} from "../Toolbar";
import type {ToolbarActionContext} from "./ToolbarActionContext";


/**
 * One Toolbar action.
 *
 * The `do` callback runs when the corresponding button is clicked
 * (or when the action is invoked programmatically). It receives a
 * {@link ToolbarActionContext} with everything it needs to read
 * Viewer / DemoHelper state, push pressed-state changes onto its
 * button, and forward through the host's `onAction` override.
 */
export interface ToolbarActionDescriptor {
  /** Stable action id, matching the union in {@link ToolbarAction}. */
  readonly id: ToolbarAction;
  /** Run the action against the supplied context. */
  do(ctx: ToolbarActionContext): void;
}
