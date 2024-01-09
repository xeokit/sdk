import {BCFViewSetupHints} from "./BCFViewSetupHints";
import {BCFComponent} from "./BCFComponent";

/**
 * TODO
 */
export interface BCFVisibilityComponent {

    /**
     * TODO
     */
    view_setup_hints: BCFViewSetupHints;

    /**
     * TODO
     */
    default_visibility: boolean,

    /**
     * TODO
     */
    exceptions: BCFComponent[],
}