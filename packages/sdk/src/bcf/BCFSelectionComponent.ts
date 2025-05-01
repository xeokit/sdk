import type { BCFComponent } from "./BCFComponent";

/**
 * BCF selection component.
 */
export interface BCFSelectionComponent {

  /**
     * If true: Selects all components, and unselects the exceptions. If false: Unselect all components and select exceptions.
     */
  default_selection: boolean,

  /**
     * Components to select/unselect determined by default_selection.
     */
  exceptions: BCFComponent[]
}
