/**
 * @xeokit/sdk root entry point.
 *
 * Top-level buckets group modules by topical aim — see the per-bucket
 * index.ts files for what's inside each. Each module lives under its
 * topical bucket: `model/scene`, `model/data`, `viewing/viewer`, …
 *
 * @module @xeokit/sdk
 * @document ../../../WHITEPAPER.md
 * @document ../../../WHITEPAPER_EXEC.md
 * @document ../../../WHITEPAPER_SCENEMODEL_UPDATE_HINTS.md
 */
export * as base          from "./base";
export * as model         from "./model";
export * as formats       from "./formats";
export * as quality       from "./quality";
export * as spatial       from "./spatial";
export * as viewing       from "./viewing";
export * as tools         from "./tools";
export * as interop       from "./interop";
export * as conversion    from "./conversion";
