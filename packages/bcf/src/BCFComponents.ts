import {BCFColoringComponent} from "./BCFColoringComponent";
import {BCFVisibilityComponent} from "./BCFVisibilityComponent";
import {BCFComponent} from "./BCFComponent";

/**
 * TODO
 */
export interface BCFComponents {

    /**
     * TODO
     */
    coloring: BCFColoringComponent[];

    /**
     * TODO
     */
    visibility?: BCFVisibilityComponent;

    /**
     * TODO
     */
    selection?: BCFComponent[];

    /**
     * TODO
     */
    translucency: BCFComponent[];
}