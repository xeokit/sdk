import { BCFColoringComponent } from "./BCFColoringComponent";
import { BCFComponent } from "./BCFComponent";
import { BCFVisibilityComponent } from "./BCFVisibilityComponent";

/**
 * Visual states of BCF components.
 */
export interface BCFComponents {

  /**
     * Colored BCF components.
     */
  coloring: BCFColoringComponent[];

  /**
     * Visibility BCF components.
     */
  visibility?: BCFVisibilityComponent;

  /**
     * Selected BCF components.
     */
  selection?: BCFComponent[];

  /**
     * X-rayed BCF components.
     */
  translucency: BCFComponent[];
}
