/**
 * Class representing flags for a view, including a flag to indicate if a needsRender is needed.
 *
 * @internal
 */
export class ViewFlags {

  /**
   * Indicates whether the view needs to be re-rendered.
   */
  public needsRender: boolean = false;

  constructor() {
    this.needsRender = false;
  }
}
