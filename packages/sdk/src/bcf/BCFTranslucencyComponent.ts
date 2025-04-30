import { BCFComponent } from "./BCFComponent";
import { BCFViewSetupHints } from "./BCFViewSetupHints";

/**
 * BCF translucency components.
 */
export interface BCFTranslucencyComponent {

  /**
     * Hints about the setup of the viewer.
     */
  view_setup_hints: BCFViewSetupHints;

  /**
     * If true: X-rays all components, and un-X-rays the exceptions. If false: Un-X-ray all components and X-ray exceptions.
     */
  default_translucency: boolean;

  /**
     * Components to apply/remove X-ray, as determined by default_translucency.
     */
  exceptions: BCFComponent[];
}
