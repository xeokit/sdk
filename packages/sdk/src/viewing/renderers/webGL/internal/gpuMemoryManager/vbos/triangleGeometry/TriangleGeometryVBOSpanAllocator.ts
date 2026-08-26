import type {TriangleGeometryVBOVertexSpan} from "./TriangleGeometryVBOState";

/**
 * Allocates fixed-size vertex spans inside one triangle VBO batch.
 *
 * Removed meshes leave reusable free spans. If the last span in the batch is
 * freed, the allocator moves the high-water cursor back so later meshes can
 * reuse that tail space.
 *
 * @internal
 */
export class TriangleGeometryVBOSpanAllocator {
  private readonly _capacity: number;
  private readonly _freeVertexSpans: TriangleGeometryVBOVertexSpan[] = [];
  private _nextVertex = 0;

  constructor(capacity: number) {
    this._capacity = Math.max(0, capacity | 0);
  }

  get nextVertex(): number {
    return this._nextVertex;
  }

  get freeVertexSpans(): TriangleGeometryVBOVertexSpan[] {
    return this._freeVertexSpans;
  }

  clear(): void {
    this._freeVertexSpans.length = 0;
    this._nextVertex = 0;
  }

  hasAvailable(vertexCount: number): boolean {
    if (vertexCount <= 0) {
      return false;
    }
    if (this._nextVertex + vertexCount <= this._capacity) {
      return true;
    }
    for (const span of this._freeVertexSpans) {
      if (span.count >= vertexCount) {
        return true;
      }
    }
    return false;
  }

  allocate(vertexCount: number): number {
    for (let i = 0, len = this._freeVertexSpans.length; i < len; i++) {
      const span = this._freeVertexSpans[i];
      if (span.count < vertexCount) {
        continue;
      }
      const base = span.base;
      if (span.count === vertexCount) {
        this._freeVertexSpans.splice(i, 1);
      } else {
        span.base += vertexCount;
        span.count -= vertexCount;
      }
      return base;
    }
    if (this._nextVertex + vertexCount > this._capacity) {
      return -1;
    }
    const base = this._nextVertex;
    this._nextVertex += vertexCount;
    return base;
  }

  release(vertexBase: number, vertexCount: number): void {
    if (vertexCount <= 0) {
      return;
    }
    this._freeVertexSpans.push({base: vertexBase, count: vertexCount});
    TriangleGeometryVBOSpanAllocator.coalesceSpans(this._freeVertexSpans);
    this._trimTrailingFreeVertexSpans();
  }

  static coalesceSpans(spans: TriangleGeometryVBOVertexSpan[]): void {
    if (spans.length <= 1) {
      return;
    }
    spans.sort((a, b) => a.base - b.base);
    let writeIndex = 0;
    for (let readIndex = 1; readIndex < spans.length; readIndex++) {
      const current = spans[readIndex];
      const previous = spans[writeIndex];
      const previousEnd = previous.base + previous.count;
      if (current.base <= previousEnd) {
        previous.count = Math.max(previousEnd, current.base + current.count) - previous.base;
      } else {
        writeIndex++;
        spans[writeIndex] = current;
      }
    }
    spans.length = writeIndex + 1;
  }

  private _trimTrailingFreeVertexSpans(): void {
    while (this._freeVertexSpans.length > 0) {
      const last = this._freeVertexSpans[this._freeVertexSpans.length - 1];
      if (last.base + last.count !== this._nextVertex) {
        return;
      }
      this._nextVertex = last.base;
      this._freeVertexSpans.pop();
    }
  }
}
