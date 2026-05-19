/**
 * @xeokit/sdk root entry point.
 *
 * Top-level buckets group modules by topical aim — see the per-bucket
 * index.ts files for what's inside each. The flat names that used to
 * live here (scene, data, viewer, etc.) now live under their
 * topical bucket: `model/scene`, `model/data`, `viewing/viewer`, …
 */
export * as base          from "./base";
export * as model         from "./model";
export * as formats       from "./formats";
export * as inspect       from "./inspect";
export * as spatial       from "./spatial";
export * as viewing       from "./viewing";
export * as presentations from "./presentations";
export * as tools         from "./tools";
export * as simulation    from "./simulation";
export * as interop       from "./interop";
export * as convert       from "./convert";
export * as ui            from "./ui";
export * as studio        from "./studio";
