import {readXGFStreamingRuntimeIndex} from "../readXGFStreamingRuntimeIndex";
import {writeXGFStreamingRuntimeIndex} from "../writeXGFStreamingRuntimeIndex";
import type {XGFStreamingIndex} from "../XGFStreamingIndex";

describe("XGFStreamingIndex", () => {
  it("round-trips recursive stream references through the runtime index", () => {
    const index: XGFStreamingIndex = {
      format: "XGFStreamingIndex",
      indexVersion: "1.1.0",
      chunks: [],
      streams: [{
        id: "baku-east",
        uri: "baku-east/index.runtime.json",
        aabb: [10, 20, 30, 40, 50, 60],
        origin: [1000, 0, 0],
        priority: 3,
        metadata: {label: "Baku East"}
      }],
      aabb: [10, 20, 30, 40, 50, 60]
    };

    const runtimeIndex = writeXGFStreamingRuntimeIndex(index);
    const result = readXGFStreamingRuntimeIndex(runtimeIndex);

    expect(runtimeIndex.indexVersion).toBe("1.2.0");
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.streams).toEqual(index.streams);
    expect(result.ok && result.value.chunks).toEqual([]);
  });

  it("does not quantize runtime substream AABBs against distant stream extents", () => {
    const index: XGFStreamingIndex = {
      format: "XGFStreamingIndex",
      indexVersion: "1.2.0",
      chunks: [],
      streams: [{
        id: "small",
        uri: "small/index.runtime.json",
        aabb: [10.125, 20.25, 30.5, 10.375, 20.75, 31.5]
      }],
      aabb: [-1000000, -1000000, -1000000, 1000000, 1000000, 1000000]
    };

    const runtimeIndex = writeXGFStreamingRuntimeIndex(index);
    const result = readXGFStreamingRuntimeIndex(runtimeIndex);

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.streams?.[0].aabb).toEqual(index.streams?.[0].aabb);
  });

  it("round-trips stream coordinate systems through the runtime index", () => {
    const index: XGFStreamingIndex = {
      format: "XGFStreamingIndex",
      indexVersion: "1.2.0",
      chunks: [],
      coordinateSystem: {
        basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
        origin: [100, 200, 300],
        units: "meters",
        scaleToMeters: 1
      },
      aabb: [0, 0, 0, 1, 1, 1]
    };

    const runtimeIndex = writeXGFStreamingRuntimeIndex(index);
    const result = readXGFStreamingRuntimeIndex(runtimeIndex);

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.coordinateSystem).toEqual(index.coordinateSystem);
  });
});
