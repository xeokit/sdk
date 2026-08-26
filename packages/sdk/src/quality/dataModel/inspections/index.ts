/**
 * Built-in inspections shipped with the DataModel inspector.
 * Pre-registered into {@link DEFAULT_INSPECTION_REGISTRY}.
 *
 * Organised by schema concern:
 *
 *   - {@link generic} — schema-agnostic structural checks.
 *   - {@link schema}  — driven by a {@link DataFormatSchema}.
 *   - {@link formats!ifc | ifc}     — IFC-specific (gated to common IFC schema ids).
 *
 * @module dataModelInspector/inspections
 */
export * from "./generic";
export * from "./schema";
export * from "./ifc";
