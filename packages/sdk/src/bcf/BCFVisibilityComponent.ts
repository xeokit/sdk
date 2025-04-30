import type { BCFComponent } from "./BCFComponent";
import type { BCFViewSetupHints } from "./BCFViewSetupHints";

/**
 * BCF visibility component.
 */
export interface BCFVisibilityComponent {

  /**
     * View setup hints.
     */
  view_setup_hints: BCFViewSetupHints;

  /**
     * If true: Shows all components, and hides the exceptions. If false: Hide all components and show exceptions.
     */
  default_visibility: boolean,

  /**
     * Components to show/hide determined by default_visibility.
     */
  exceptions: BCFComponent[],
}
