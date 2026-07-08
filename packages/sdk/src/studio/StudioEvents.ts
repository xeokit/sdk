/**
 * Events emitted by a {@link Studio}.
 *
 * Mirrors the `*.events` shape of {@link model!scene.Scene | Scene},
 * {@link model!data.Data | Data}, {@link viewing!viewer.Viewer | Viewer},
 * and the configured renderer backend —
 * a single class with one `EventEmitter` per channel, exposed as
 * `studio.events`. The Studio's `reportError` / `reportWarning`
 * helpers dispatch through `onError` / `onWarning` here; the
 * {@link panels!issuesPanel.IssuesPanel | IssuesPanel} subscribes
 * to both, alongside the same channels on the four subsystem
 * `.events` it already monitors.
 *
 * Studio panels (CameraTourPanel, DrawingsPanel, etc.) report
 * via the host helper's
 * {@link Studio.reportError | Studio.reportError} /
 * {@link Studio.reportWarning | Studio.reportWarning} so a single
 * pipeline carries every studio-side failure to the IssuesPanel.
 */
import {EventEmitter, type SDKResult} from "../base/core";
import {EventDispatcher} from "strongly-typed-events";

import type {Studio} from "./Studio";


export class StudioEvents {

  /**
   * Fires when an error occurs anywhere in the Studio — auto-mount
   * failures (Toolbar, IssuesPanel), `loadModel` failures, panel-
   * level operations that can't proceed (planning a tour against
   * a missing View, etc.).
   *
   * Non-fatal: the dispatch never throws. Subscribers receive an
   * `SDKResult<any>` payload whose `error` field is the human-
   * readable message and `type` is the `SDKErrorType` enum value.
   */
  public readonly onError: EventEmitter<Studio, SDKResult<any>>;

  /**
   * Fires when a recoverable warning occurs in the Studio — IBL
   * setup that fell back to a default sky, a SceneModel destroy
   * that threw during teardown, etc. Same payload shape as
   * {@link onError}; severity is left to subscribers to colour-
   * code.
   */
  public readonly onWarning: EventEmitter<Studio, SDKResult<any>>;

  /**
   * @private
   */
  constructor() {
    this.onError   = new EventEmitter(new EventDispatcher<Studio, SDKResult<any>>());
    this.onWarning = new EventEmitter(new EventDispatcher<Studio, SDKResult<any>>());
  }

  /**
   * @private
   */
  clear(): void {
    this.onError.clear();
    this.onWarning.clear();
  }

  /**
   * @private
   */
  destroy(): void {
    this.clear();
  }
}
