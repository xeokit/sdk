/**
 * Split a deflated XKT container (versions prior to V11) into its element
 * buffers.
 *
 * The container is: word 0 = version, word 1 = element count, then one
 * `Uint32` byte-length per element, then the concatenated element bytes. Each
 * returned `Uint8Array` is a view onto the original buffer (still deflated —
 * the per-version parser inflates each one).
 *
 * @private
 */
export function splitElements(arrayBuffer: ArrayBuffer): Uint8Array[] {
  const dataView = new DataView(arrayBuffer);
  const dataArray = new Uint8Array(arrayBuffer);
  const numElements = dataView.getUint32(4, true);
  const elements: Uint8Array[] = [];
  let byteOffset = (numElements + 2) * 4;
  for (let i = 0; i < numElements; i++) {
    const elementSize = dataView.getUint32((i + 2) * 4, true);
    elements.push(dataArray.subarray(byteOffset, byteOffset + elementSize));
    byteOffset += elementSize;
  }
  return elements;
}
