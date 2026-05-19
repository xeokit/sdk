/**
 * @module demo/panels/modelsPanel/ModelsPanelParams
 */

import type {Studio} from "../../Studio";


export interface ModelsPanelParams {
  studio: Studio;
  container?: HTMLElement;
  visible?: boolean;
}
