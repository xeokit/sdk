// Re-export the @xeokit/sdk bucketed namespace structure.
// Mirrors packages/sdk/src/index.ts so the demo bundle exposes the
// same public shape as the published SDK.

export * as base          from "../../sdk/src/base";
export * as model         from "../../sdk/src/model";
export * as formats       from "../../sdk/src/formats";
export * as inspect       from "../../sdk/src/inspect";
export * as spatial       from "../../sdk/src/spatial";
export * as viewing       from "../../sdk/src/viewing";
export * as presentations from "../../sdk/src/presentations";
export * as tools         from "../../sdk/src/tools";
export * as simulation    from "../../sdk/src/simulation";
export * as interop       from "../../sdk/src/interop";
export * as convert       from "../../sdk/src/convert";
export * as ui            from "../../sdk/src/ui";
export * as studio        from "../../sdk/src/studio";
