import type {View} from "../../viewer";
import type {WebGPUDrawItem, WebGPUMeshState, WebGPURenderBins} from "./types";
import {WebGPUMeshManager} from "./WebGPUMeshManager";

/**
 * Sorts WebGPU mesh states into per-frame render bins.
 *
 * @internal
 */
export class WebGPURenderBinClassifier {

  private readonly _drawItemPool: WebGPUDrawItem[] = [];
  private _drawItemPoolCount = 0;

  public clear(bins: WebGPURenderBins): void {
    bins.normalDrawOpaque.length = 0;
    bins.normalFillTransparent.length = 0;
    this._drawItemPoolCount = 0;
  }

  public classify(params: {
    meshStates: ReadonlyArray<WebGPUMeshState>;
    view: View;
    meshManager: WebGPUMeshManager;
    bins: WebGPURenderBins;
  }): void {
    const {meshStates, view, meshManager, bins} = params;

    for (const meshState of meshStates) {
      if (!meshManager.isMeshVisibleInView(meshState, view)) {
        continue;
      }

      const opacity = meshManager.getMeshOpacityInView(meshState, view);
      if (opacity <= 0) {
        continue;
      }

      const drawItem = this._nextDrawItem();
      drawItem.meshState = meshState;
      drawItem.opacity = opacity;

      if (opacity >= 1) {
        drawItem.viewDepth = 0;
        bins.normalDrawOpaque.push(drawItem);
      } else {
        drawItem.viewDepth = meshManager.getMeshViewDepth(meshState, view);
        bins.normalFillTransparent.push(drawItem);
      }
    }

    bins.normalFillTransparent.sort((a, b) => a.viewDepth - b.viewDepth);
  }

  private _nextDrawItem(): WebGPUDrawItem {
    let drawItem = this._drawItemPool[this._drawItemPoolCount];
    if (!drawItem) {
      drawItem = {
        meshState: null as any,
        opacity: 1,
        viewDepth: 0
      };
      this._drawItemPool.push(drawItem);
    }
    this._drawItemPoolCount++;
    return drawItem;
  }
}
