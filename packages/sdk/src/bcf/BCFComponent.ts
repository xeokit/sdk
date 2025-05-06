/**
 * A BCF component.
 */
export interface BCFComponent {

  /**
   * IFC guid of the component.
   */
  "ifc_guid": string,

  /**
   * Originating system of the BCF component.
   */
  "originating_system"?: string,

  /**
   * Internal ID for the authoring tool of the BCF component.
   */
  "authoring_tool_id"?: string
}
