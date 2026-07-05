/**
 * Returns an element's visible CSS-pixel size.
 *
 * Pointer events that callers convert with `clientX/Y - rect.left/top` are in
 * `getBoundingClientRect()` coordinates. Use the same dimensions when turning
 * those coordinates into NDC or projecting world points back into overlay
 * space. Fall back to layout metrics for hidden/jsdom elements whose rect has
 * not been populated.
 *
 * @internal
 */
export function getElementCssSize(element: HTMLElement): { width: number; height: number } {
  const rect = element.getBoundingClientRect();
  const width = finitePositive(rect.width)
    ? rect.width
    : fallbackDimension(element.clientWidth, element.offsetWidth);
  const height = finitePositive(rect.height)
    ? rect.height
    : fallbackDimension(element.clientHeight, element.offsetHeight);
  return {width, height};
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function fallbackDimension(client: number, offset: number): number {
  if (finitePositive(client)) return client;
  if (finitePositive(offset)) return offset;
  return 1;
}
