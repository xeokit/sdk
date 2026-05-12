/**
 * Registry of Toolbar action handlers.
 *
 * Each entry pairs a stable {@link ToolbarAction} id with a `do`
 * implementation in its own file. The Toolbar's button-registration
 * code looks each action up here at click time, so adding a new
 * button is a matter of:
 *
 *   1. Authoring a `<action>.ts` descriptor file in this folder.
 *   2. Adding it to {@link TOOLBAR_ACTIONS} below.
 *   3. Registering a button in `Toolbar.ts`'s `_buildDom`.
 *
 * `Toolbar.ts` no longer needs `_actionX` methods — the registry
 * is the single source of truth for action behaviour.
 *
 * @module demo/toolbar/actions
 */

import type {ToolbarAction} from "../Toolbar";
import type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";

import {fitAll}              from "./fitAll";
import {importModel}         from "./importModel";
import {importSampleModel}   from "./importSampleModel";
import {openExport}          from "./openExport";
import {resetView}           from "./resetView";
import {toggle2D3D}          from "./toggle2D3D";
import {toggleAnglePanel}    from "./toggleAnglePanel";
import {toggleDistancePanel} from "./toggleDistancePanel";
import {toggleExplorer}      from "./toggleExplorer";
import {toggleFirstPerson}   from "./toggleFirstPerson";
import {toggleModels}        from "./toggleModels";
import {toggleNavCube}       from "./toggleNavCube";
import {toggleProjection}    from "./toggleProjection";
import {toggleViews}         from "./toggleViews";


/**
 * Toolbar action registry, keyed by {@link ToolbarAction} id.
 *
 * The two entries with no descriptor — `openFiles` and
 * `toolModeChanged` — aren't direct button clicks (`openFiles`
 * opens a dropdown, `toolModeChanged` is a notification fired by
 * the tool-mode setter), so they have no `do` body and aren't
 * looked up here.
 */
export const TOOLBAR_ACTIONS: Partial<Record<ToolbarAction, ToolbarActionDescriptor>> = {
  fitAll,
  importModel,
  importSampleModel,
  openExport,
  resetView,
  toggle2D3D,
  toggleAnglePanel,
  toggleDistancePanel,
  toggleExplorer,
  toggleFirstPerson,
  toggleModels,
  toggleNavCube,
  toggleProjection,
  toggleViews,
};

export type {ToolbarActionContext} from "./ToolbarActionContext";
export type {ToolbarActionDescriptor} from "./ToolbarActionDescriptor";
