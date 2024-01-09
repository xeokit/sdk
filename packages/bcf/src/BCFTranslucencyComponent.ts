import {BCFViewSetupHints} from "./BCFViewSetupHints";
import {BCFComponent} from "./BCFComponent";

/**
 * TODO
 */
export interface BCFTranslucencyComponent {

    /**
     * TODO
     */
    view_setup_hints: BCFViewSetupHints;

    /**
     * TODO
     */
    default_translucency: boolean,

    /**
     * TODO
     */
    exceptions: BCFComponent[]
}