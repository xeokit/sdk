/**
 * Standard technical-drawing title cartouche, drawn inside the
 * bottom-right corner of the projection frame.
 */
export interface TitleBlockSpec {
  /** Heading row text — drawn in the top of the cartouche. */
  title: string;
  /**
   * Optional labelled rows below the heading, drawn as
   * `LABEL | value` pairs separated by a vertical divider. The
   * row count drives the cartouche's height.
   */
  rows?: ReadonlyArray<{ label: string; value: string }>;
  /**
   * Cartouche width as a fraction of the frame's projected
   * width (`[0, 1]`). Default 0.42.
   */
  widthFraction?: number;
}
