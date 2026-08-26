// Re-export the @xeokit/sdk bucketed namespace structure.
// Mirrors packages/sdk/src/index.ts so the demo bundle exposes the
// same public shape as the published SDK.

export * as base          from "../../sdk/src/base";
export * as model         from "../../sdk/src/model";
export * as formats       from "../../sdk/src/formats";
export * as quality       from "../../sdk/src/quality";
export * as spatial       from "../../sdk/src/spatial";
export * as viewing       from "../../sdk/src/viewing";
export * as tools         from "../../sdk/src/tools";
export * as interop       from "../../sdk/src/interop";
export * as conversion    from "../../sdk/src/conversion";
export * as ui            from "../libs/ui/src";
export * as presentations from "../libs/presentations/src";
export * as studio        from "../libs/studio/src";
